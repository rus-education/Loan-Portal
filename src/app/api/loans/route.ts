import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { LoanApplication } from "@/models/LoanApplication";
import { Branch } from "@/models/Branch";
import { requireAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";

const createLoanSchema = z.object({
  sdmId: z.string().min(1, "SDM ID is required").trim(),
  studentName: z.string().min(1, "Student name is required").trim(),
  contactNumber: z.string().min(1, "Contact number is required").trim(),
  branchId: z.string().optional(),
  course: z.string().min(1, "Course is required").trim(),
  country: z.string().min(1, "Country is required").trim(),
  loanAmount: z.number().min(0, "Loan amount cannot be negative"),
  intakeMonth: z.string().min(1, "Intake month is required").trim(),
  intakeYear: z.number().int().min(2000).max(2100),
  parentGuardianIncomeSource: z.string().min(1, "Parent/Guardian income source is required").trim(),
  currentStage: z.string().trim().default("Initial Inquiry"),
  branchRemarks: z.string().trim().default(""),
});

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
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limitParam = parseInt(searchParams.get("limit") || "25", 10);
    const limit = [25, 50, 100].includes(limitParam) ? limitParam : 25;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    // 1. Strict Server-Side Branch Isolation for BRANCH_USER
    if (user.role === "BRANCH_USER") {
      if (!user.branchId) {
        return NextResponse.json(
          { success: false, error: "Branch user is not assigned to a branch", code: "NO_BRANCH_ASSIGNED" },
          { status: 403 }
        );
      }
      // If user passed a branchId param that doesn't match their own, reject
      if (requestedBranchId && requestedBranchId !== user.branchId) {
        return NextResponse.json(
          { success: false, error: "Access denied to unauthorized branch records", code: "FORBIDDEN_BRANCH_ACCESS" },
          { status: 403 }
        );
      }
      filter.branchId = user.branchId;
    } else {
      // SUPERADMIN, ADMIN, VIEWER can query across branches or filter
      if (requestedBranchId) {
        filter.branchId = requestedBranchId;
      }
    }

    // Status filter
    if (status) {
      filter.status = status;
    }

    // Intake Month & Year filters
    const intakeMonth = searchParams.get("intakeMonth");
    const intakeYear = searchParams.get("intakeYear");
    if (intakeMonth) filter.intakeMonth = intakeMonth;
    if (intakeYear) filter.intakeYear = parseInt(intakeYear, 10);

    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Specific field-targeted search filters
    const sdmIdParam = searchParams.get("sdmId");
    const studentNameParam = searchParams.get("studentName");
    const contactNumberParam = searchParams.get("contactNumber");

    if (sdmIdParam?.trim()) {
      filter.sdmId = { $regex: escapeRegex(sdmIdParam.trim()), $options: "i" };
    }
    if (studentNameParam?.trim()) {
      filter.studentName = { $regex: escapeRegex(studentNameParam.trim()), $options: "i" };
    }
    if (contactNumberParam?.trim()) {
      filter.contactNumber = { $regex: escapeRegex(contactNumberParam.trim()), $options: "i" };
    }

    // Global search query (searches SDM ID, student name, contact number, course, country)
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

    // Date range filtering (presets: 30d, 90d, 6m, 1y, or custom startDate / endDate)
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const dateRange = searchParams.get("dateRange");

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

    // Stable column sorting with unique tie-breaker to prevent pagination duplication/skipping
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1;
    const allowedSortFields = ["createdAt", "loanAmount", "studentName", "status", "sdmId", "intakeYear"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortConfig: Record<string, 1 | -1> = {
      [sortField]: sortOrder as 1 | -1,
      _id: sortOrder as 1 | -1,
    };

    const hasFilters = Object.keys(filter).length > 0;

    const [loans, total] = await Promise.all([
      LoanApplication.find(filter)
        .select("sdmId studentName contactNumber branchId course country loanAmount intakeMonth intakeYear currentStage status branchRemarks adminRemarks createdAt updatedAt")
        .populate("branchId", "name code status")
        .sort(sortConfig)
        .skip(skip)
        .limit(limit)
        .lean(),
      hasFilters
        ? LoanApplication.countDocuments(filter)
        : LoanApplication.estimatedDocumentCount(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      success: true,
      data: loans,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      userRole: user.role,
      userBranchId: user.branchId,
    });
  } catch (err: unknown) {
    console.error("[loans:GET] Error fetching loans:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch loan applications" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if ("status" in authResult) return authResult;
    const { user } = authResult;

    // RBAC: Only BRANCH_USER and SUPERADMIN can create loan applications
    if (!hasPermission(user.role, "loan:create")) {
      return NextResponse.json(
        {
          success: false,
          error: `Role '${user.role}' is not authorized to create loan applications`,
          code: "FORBIDDEN_ROLE_CANNOT_CREATE",
        },
        { status: 403 }
      );
    }

    await connectToDatabase();
    const body = await request.json();
    const parsed = createLoanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation error",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Enforce Branch Assignment
    let targetBranchId: string;
    if (user.role === "BRANCH_USER") {
      if (!user.branchId) {
        return NextResponse.json(
          { success: false, error: "Branch user is not assigned to any branch" },
          { status: 403 }
        );
      }
      targetBranchId = user.branchId;
    } else {
      // Superadmin must supply or have a valid branchId
      if (!data.branchId) {
        return NextResponse.json(
          { success: false, error: "Branch ID is required for application creation" },
          { status: 400 }
        );
      }
      targetBranchId = data.branchId;
    }

    // Verify branch exists & is active
    const branchDoc = await Branch.findById(targetBranchId);
    if (!branchDoc || branchDoc.status !== "active") {
      return NextResponse.json(
        { success: false, error: "Target branch not found or is inactive" },
        { status: 400 }
      );
    }

    // Create loan application with workflow status initialized strictly to 'Pending'
    const newLoan = await LoanApplication.create({
      sdmId: data.sdmId,
      studentName: data.studentName,
      contactNumber: data.contactNumber,
      branchId: targetBranchId,
      course: data.course,
      country: data.country,
      loanAmount: data.loanAmount,
      intakeMonth: data.intakeMonth,
      intakeYear: data.intakeYear,
      parentGuardianIncomeSource: data.parentGuardianIncomeSource,
      currentStage: data.currentStage || "Initial Inquiry",
      status: "Pending", // Always begins in Pending
      statusHistory: [
        {
          fromStatus: "None",
          toStatus: "Pending",
          changedBy: user.id,
          changedByName: user.name,
          remarks: "Application registered at branch",
          timestamp: new Date(),
        },
      ],
      branchRemarks: data.branchRemarks || "",
      adminRemarks: "", // Branch users cannot set admin remarks
      createdBy: user.id,
      updatedBy: null,
    });

    const populated = await LoanApplication.findById(newLoan._id)
      .populate("branchId", "name code")
      .populate("createdBy", "name email");

    // Audit log
    await logAuditEvent({
      userId: user.id,
      action: "LOAN_APPLICATION_CREATED",
      entity: "LoanApplication",
      entityId: String(newLoan._id),
      newValue: {
        sdmId: newLoan.sdmId,
        studentName: newLoan.studentName,
        branchId: targetBranchId,
        loanAmount: newLoan.loanAmount,
        status: newLoan.status,
      },
      request,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Loan application created successfully",
        data: populated,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("[loans:POST] Error creating loan:", err);
    return NextResponse.json(
      { success: false, error: "Failed to create loan application" },
      { status: 500 }
    );
  }
}
