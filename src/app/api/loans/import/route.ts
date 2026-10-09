import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { LoanApplication } from "@/models/LoanApplication";
import { Branch } from "@/models/Branch";
import { requireAuth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

interface ParsedRow {
  rowNumber: number;
  sdmId: string;
  studentName: string;
  contactNumber: string;
  branchCode: string;
  course: string;
  country: string;
  loanAmount: number;
  intakeMonth: string;
  intakeYear: number;
  parentGuardianIncomeSource: string;
  currentStage: string;
  branchRemarks: string;
}

interface RowError {
  row: number;
  sdmId?: string;
  error: string;
}

// RFC 4180 Compliant CSV line parser
function parseCsv(text: string): string[][] {
  const cleanText = text.replace(/^\uFEFF/, "").trim(); // Remove UTF-8 BOM
  if (!cleanText) return [];

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (insideQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentField.trim());
        currentField = "";
      } else if (char === "\r" && nextChar === "\n") {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
        i++; // skip \n
      } else if (char === "\n") {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  return rows;
}

const rowValidationSchema = z.object({
  sdmId: z
    .string()
    .min(2, "SDM ID must be at least 2 characters")
    .max(50, "SDM ID cannot exceed 50 characters")
    .trim(),
  studentName: z
    .string()
    .min(2, "Student name must be at least 2 characters")
    .max(120, "Student name cannot exceed 120 characters")
    .trim(),
  contactNumber: z
    .string()
    .min(7, "Contact number must have at least 7 digits")
    .max(25, "Contact number too long")
    .trim(),
  branchCode: z.string().min(1, "Branch code is required").trim(),
  course: z.string().min(2, "Course name is required").trim(),
  country: z.string().min(2, "Country is required").trim(),
  loanAmount: z.number().positive("Loan amount must be greater than zero"),
  intakeMonth: z.string().min(3, "Intake month is required").trim(),
  intakeYear: z.number().int().min(2020, "Intake year must be 2020 or later").max(2035, "Intake year invalid"),
  parentGuardianIncomeSource: z.string().min(2, "Income source description is required").trim(),
  currentStage: z.string().default("Initial Inquiry"),
  branchRemarks: z.string().default(""),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if ("status" in authResult) return authResult;
    const { user } = authResult;

    // RBAC: Only SUPERADMIN and BRANCH_USER can import applications
    if (user.role !== "SUPERADMIN" && user.role !== "BRANCH_USER") {
      return NextResponse.json(
        { success: false, error: "Only Superadmin or Branch officers are authorized to import applications" },
        { status: 403 }
      );
    }

    await connectToDatabase();

    let csvContent = "";
    let isDryRun = false;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      isDryRun = formData.get("dryRun") === "true";

      if (!file || typeof file === "string") {
        return NextResponse.json(
          { success: false, error: "No CSV file uploaded in form data" },
          { status: 400 }
        );
      }
      csvContent = await (file as Blob).text();
    } else {
      const jsonBody = await request.json();
      csvContent = jsonBody.csvContent || "";
      isDryRun = Boolean(jsonBody.dryRun);
    }

    if (!csvContent.trim()) {
      return NextResponse.json(
        { success: false, error: "CSV content is empty" },
        { status: 400 }
      );
    }

    const rawRows = parseCsv(csvContent);
    if (rawRows.length < 2) {
      return NextResponse.json(
        { success: false, error: "CSV must contain at least a header row and one data row" },
        { status: 400 }
      );
    }

    // Normalize Header indices
    const headerRow = rawRows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const findCol = (...aliases: string[]): number => {
      for (const alias of aliases) {
        const cleaned = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
        const idx = headerRow.indexOf(cleaned);
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const colIndices = {
      sdmId: findCol("sdmid", "sdm", "id", "applicationid"),
      studentName: findCol("studentname", "student", "name", "candidate"),
      contactNumber: findCol("contactnumber", "contact", "phone", "mobile"),
      branchCode: findCol("branchcode", "branch", "branchname", "branchid"),
      course: findCol("course", "program", "degree"),
      country: findCol("country", "destination"),
      loanAmount: findCol("loanamount", "amount", "loan", "loanamountinr"),
      intakeMonth: findCol("intakemonth", "month", "intake"),
      intakeYear: findCol("intakeyear", "year"),
      parentGuardianIncomeSource: findCol("parentguardianincomesource", "incomesource", "parentincome", "income"),
      currentStage: findCol("currentstage", "stage"),
      branchRemarks: findCol("branchremarks", "remarks", "counselorremarks"),
    };

    if (colIndices.studentName === -1 || colIndices.loanAmount === -1) {
      return NextResponse.json(
        {
          success: false,
          error: "Required columns missing. CSV must include headers for 'Student Name' and 'Loan Amount'.",
        },
        { status: 400 }
      );
    }

    // Load active branches for resolution
    const branches = await Branch.find({}).lean();
    const branchCodeMap = new Map<string, typeof branches[0]>();
    const branchNameMap = new Map<string, typeof branches[0]>();

    for (const b of branches) {
      branchCodeMap.set(b.code.toUpperCase(), b);
      branchNameMap.set(b.name.toLowerCase(), b);
    }

    // Fetch existing SDM IDs to prevent collisions
    const existingSdmIds = new Set(
      (await LoanApplication.find({}, { sdmId: 1 }).lean()).map((l) => l.sdmId)
    );

    const validRows: Array<ParsedRow & { branchObjId: unknown }> = [];
    const errors: RowError[] = [];
    const seenBatchSdmIds = new Set<string>();

    // Process data rows
    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (row.length === 0 || (row.length === 1 && !row[0])) continue; // Skip empty line

      const rowNum = i + 1; // 1-indexed for user display

      const rawAmountStr = (row[colIndices.loanAmount] || "").replace(/[^0-9.]/g, "");
      const rawYearStr = (row[colIndices.intakeYear] || "").replace(/[^0-9]/g, "");

      const candidateObj = {
        sdmId: row[colIndices.sdmId] || `SDM-IMP-${Date.now()}-${rowNum}`,
        studentName: row[colIndices.studentName] || "",
        contactNumber: row[colIndices.contactNumber] || "",
        branchCode: row[colIndices.branchCode] || "",
        course: row[colIndices.course] || "",
        country: row[colIndices.country] || "",
        loanAmount: Number(rawAmountStr) || 0,
        intakeMonth: row[colIndices.intakeMonth] || "September",
        intakeYear: Number(rawYearStr) || new Date().getFullYear(),
        parentGuardianIncomeSource:
          colIndices.parentGuardianIncomeSource !== -1
            ? row[colIndices.parentGuardianIncomeSource] || "Salaried"
            : "Salaried",
        currentStage:
          colIndices.currentStage !== -1 && row[colIndices.currentStage]
            ? row[colIndices.currentStage]
            : "Initial Inquiry",
        branchRemarks:
          colIndices.branchRemarks !== -1 && row[colIndices.branchRemarks]
            ? row[colIndices.branchRemarks]
            : "Imported via CSV batch",
      };

      // 1. Zod schema validation
      const parseResult = rowValidationSchema.safeParse(candidateObj);
      if (!parseResult.success) {
        errors.push({
          row: rowNum,
          sdmId: candidateObj.sdmId,
          error: parseResult.error.issues.map((e) => e.message).join("; "),
        });
        continue;
      }

      const validData = parseResult.data;

      // 2. Duplicate SDM ID checks
      if (existingSdmIds.has(validData.sdmId)) {
        errors.push({
          row: rowNum,
          sdmId: validData.sdmId,
          error: `SDM ID '${validData.sdmId}' already exists in system records`,
        });
        continue;
      }

      if (seenBatchSdmIds.has(validData.sdmId)) {
        errors.push({
          row: rowNum,
          sdmId: validData.sdmId,
          error: `Duplicate SDM ID '${validData.sdmId}' found within this import batch`,
        });
        continue;
      }
      seenBatchSdmIds.add(validData.sdmId);

      // 3. Branch resolution & RBAC enforcement
      let targetBranch = branchCodeMap.get(validData.branchCode.toUpperCase());
      if (!targetBranch) {
        targetBranch = branchNameMap.get(validData.branchCode.toLowerCase());
      }

      // If branch user did not supply branch code, fall back to user's branch
      if (!targetBranch && user.role === "BRANCH_USER" && user.branchId) {
        targetBranch = branches.find((b) => String(b._id) === String(user.branchId));
      }

      if (!targetBranch) {
        errors.push({
          row: rowNum,
          sdmId: validData.sdmId,
          error: `Branch '${validData.branchCode}' does not exist in branch registry`,
        });
        continue;
      }

      if (targetBranch.status !== "active") {
        errors.push({
          row: rowNum,
          sdmId: validData.sdmId,
          error: `Branch '${targetBranch.name}' (${targetBranch.code}) is inactive`,
        });
        continue;
      }

      // If user is BRANCH_USER, verify branch ownership
      if (user.role === "BRANCH_USER") {
        if (String(targetBranch._id) !== String(user.branchId)) {
          errors.push({
            row: rowNum,
            sdmId: validData.sdmId,
            error: `Access Denied: You can only import applications for your assigned branch (${user.branchName || user.branchId})`,
          });
          continue;
        }
      }

      validRows.push({
        rowNumber: rowNum,
        ...validData,
        branchObjId: targetBranch._id,
      });
    }

    // If dry run, return preview and validation report
    if (isDryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        summary: {
          totalRows: rawRows.length - 1,
          validCount: validRows.length,
          invalidCount: errors.length,
        },
        errors,
        preview: validRows.slice(0, 10),
      });
    }

    // Execute actual insertion if valid rows exist
    let importedCount = 0;
    if (validRows.length > 0) {
      const now = new Date();
      const docsToInsert = validRows.map((r) => ({
        sdmId: r.sdmId,
        studentName: r.studentName,
        contactNumber: r.contactNumber,
        branchId: r.branchObjId,
        course: r.course,
        country: r.country,
        loanAmount: r.loanAmount,
        intakeMonth: r.intakeMonth,
        intakeYear: r.intakeYear,
        parentGuardianIncomeSource: r.parentGuardianIncomeSource,
        currentStage: r.currentStage,
        status: "Pending",
        statusHistory: [
          {
            fromStatus: "Draft",
            toStatus: "Pending",
            changedBy: user.id,
            changedByName: user.name,
            remarks: "Application imported via safe CSV batch",
            timestamp: now,
          },
        ],
        branchRemarks: r.branchRemarks,
        adminRemarks: "",
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      }));

      const insertResult = await LoanApplication.insertMany(docsToInsert);
      importedCount = insertResult.length;

      // Audit log the import event
      await logAuditEvent({
        userId: user.id,
        action: "LOAN_IMPORT",
        entity: "LoanApplication",
        newValue: {
          totalImported: importedCount,
          totalErrors: errors.length,
          batchSize: rawRows.length - 1,
        },
      });
    }

    return NextResponse.json({
      success: true,
      dryRun: false,
      summary: {
        totalRows: rawRows.length - 1,
        importedCount,
        failedCount: errors.length,
      },
      errors,
    });
  } catch (err: unknown) {
    console.error("[loans:IMPORT] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to process CSV import" },
      { status: 500 }
    );
  }
}
