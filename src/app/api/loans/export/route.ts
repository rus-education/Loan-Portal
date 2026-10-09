import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { LoanApplication } from "@/models/LoanApplication";
import "@/models/Branch";
import { requireAuth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return "";
  let str = String(val);

  // Prevent CSV Formula Injection (=, +, -, @, \t, \r)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // If string contains comma, quote, or newline, escape quotes and wrap in quotes
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if ("status" in authResult) return authResult;
    const { user } = authResult;

    await connectToDatabase();

    const searchParams = request.nextUrl.searchParams;
    const requestedBranchId = searchParams.get("branchId");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const sdmIdParam = searchParams.get("sdmId");
    const studentNameParam = searchParams.get("studentName");
    const contactNumberParam = searchParams.get("contactNumber");
    const intakeMonth = searchParams.get("intakeMonth");
    const intakeYear = searchParams.get("intakeYear");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const dateRange = searchParams.get("dateRange");

    const filter: Record<string, unknown> = {};

    // 1. Strict Server-Side Branch Isolation for BRANCH_USER
    if (user.role === "BRANCH_USER") {
      if (!user.branchId) {
        return NextResponse.json(
          { success: false, error: "Branch user is not assigned to a branch" },
          { status: 403 }
        );
      }
      if (requestedBranchId && requestedBranchId !== user.branchId) {
        return NextResponse.json(
          { success: false, error: "Access denied to unauthorized branch records" },
          { status: 403 }
        );
      }
      filter.branchId = user.branchId;
    } else {
      if (requestedBranchId) {
        filter.branchId = requestedBranchId;
      }
    }

    // Status filter
    if (status) {
      filter.status = status;
    }

    // Intake filters
    if (intakeMonth) filter.intakeMonth = intakeMonth;
    if (intakeYear) filter.intakeYear = parseInt(intakeYear, 10);

    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Targeted search filters
    if (sdmIdParam?.trim()) {
      filter.sdmId = { $regex: escapeRegex(sdmIdParam.trim()), $options: "i" };
    }
    if (studentNameParam?.trim()) {
      filter.studentName = { $regex: escapeRegex(studentNameParam.trim()), $options: "i" };
    }
    if (contactNumberParam?.trim()) {
      filter.contactNumber = { $regex: escapeRegex(contactNumberParam.trim()), $options: "i" };
    }

    // Global search query
    if (search?.trim()) {
      const searchRegex = { $regex: escapeRegex(search.trim()), $options: "i" };
      filter.$or = [
        { sdmId: searchRegex },
        { studentName: searchRegex },
        { contactNumber: searchRegex },
        { course: searchRegex },
        { country: searchRegex },
      ];
    }

    // Date range filtering
    let filterStart: Date | null = null;
    let filterEnd: Date | null = null;

    if (dateRange && dateRange !== "all") {
      const now = new Date();
      if (dateRange === "30d") filterStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      else if (dateRange === "90d") filterStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      else if (dateRange === "6m") filterStart = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      else if (dateRange === "1y") filterStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      filterEnd = now;
    } else if (startDate || endDate) {
      if (startDate) filterStart = new Date(startDate);
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        filterEnd = e;
      }
    }

    if (filterStart || filterEnd) {
      const dateQuery: Record<string, unknown> = {};
      if (filterStart) dateQuery.$gte = filterStart;
      if (filterEnd) dateQuery.$lte = filterEnd;
      filter.createdAt = dateQuery;
    }

    // Sorting
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1;
    const allowedSortFields = ["createdAt", "loanAmount", "studentName", "status", "sdmId", "intakeYear"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortConfig: Record<string, 1 | -1> = { [sortField]: sortOrder as 1 | -1 };

    // Fetch records (capped at 5,000 for safety)
    const loans = await LoanApplication.find(filter)
      .populate("branchId", "name code")
      .sort(sortConfig)
      .limit(5000)
      .lean();

    // Build CSV Content
    const headers = [
      "SDM ID",
      "Student Name",
      "Contact Number",
      "Branch Code",
      "Branch Name",
      "Course",
      "Country",
      "Loan Amount (INR)",
      "Intake Month",
      "Intake Year",
      "Parent Guardian Income Source",
      "Current Stage",
      "Status",
      "Branch Remarks",
      "Admin Remarks",
      "Created At",
      "Updated At",
    ];

    const rows: string[] = [headers.join(",")];

    for (const item of loans) {
      const branch = (item.branchId as unknown as { name?: string; code?: string }) || {};
      const row = [
        escapeCsvCell(item.sdmId),
        escapeCsvCell(item.studentName),
        escapeCsvCell(item.contactNumber),
        escapeCsvCell(branch.code || "N/A"),
        escapeCsvCell(branch.name || "N/A"),
        escapeCsvCell(item.course),
        escapeCsvCell(item.country),
        escapeCsvCell(item.loanAmount),
        escapeCsvCell(item.intakeMonth),
        escapeCsvCell(item.intakeYear),
        escapeCsvCell(item.parentGuardianIncomeSource),
        escapeCsvCell(item.currentStage),
        escapeCsvCell(item.status),
        escapeCsvCell(item.branchRemarks || ""),
        escapeCsvCell(item.adminRemarks || ""),
        escapeCsvCell(item.createdAt ? new Date(item.createdAt).toISOString() : ""),
        escapeCsvCell(item.updatedAt ? new Date(item.updatedAt).toISOString() : ""),
      ];
      rows.push(row.join(","));
    }

    const csvContent = "\uFEFF" + rows.join("\r\n"); // Add UTF-8 BOM for Excel compatibility

    // Audit log event
    await logAuditEvent({
      userId: user.id,
      action: "LOAN_EXPORT",
      entity: "LoanApplication",
      newValue: {
        totalExported: loans.length,
        filterApplied: Object.keys(filter),
      },
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `loan_applications_${timestamp}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err: unknown) {
    console.error("[loans:EXPORT] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to generate CSV export" },
      { status: 500 }
    );
  }
}
