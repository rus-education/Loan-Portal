import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { LoanApplication } from "@/models/LoanApplication";
import { requireAuth } from "@/lib/auth";
import { canViewLoan, validateLoanUpdatePermissions, hasPermission } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAuth(request);
    if ("status" in authResult) return authResult;
    const { user } = authResult;

    const { id } = await context.params;

    await connectToDatabase();
    const loan = await LoanApplication.findById(id)
      .populate("branchId", "name code status")
      .populate("createdBy", "name email role")
      .populate("updatedBy", "name email role")
      .lean();

    if (!loan) {
      return NextResponse.json(
        { success: false, error: "Loan application not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // IDOR Protection: Branch user can only view their own branch's record
    const loanBranchId = (loan.branchId as { _id?: unknown })?._id
      ? String((loan.branchId as { _id: unknown })._id)
      : String(loan.branchId);

    if (!canViewLoan(user, loanBranchId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden: You are not authorized to view loan records from another branch",
          code: "FORBIDDEN_BRANCH_RECORD",
        },
        { status: 403 }
      );
    }

    const statusHistory =
      Array.isArray(loan.statusHistory) && loan.statusHistory.length > 0
        ? loan.statusHistory
        : [
            {
              fromStatus: "None",
              toStatus: loan.status || "Pending",
              changedByName: (loan.createdBy as { name?: string })?.name || "Branch Officer",
              remarks: "Application registered at branch",
              timestamp: loan.createdAt,
            },
          ];

    return NextResponse.json({
      success: true,
      data: {
        ...loan,
        statusHistory,
      },
    });
  } catch (err: unknown) {
    console.error("[loans:item:GET] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch loan record" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAuth(request);
    if ("status" in authResult) return authResult;
    const { user } = authResult;

    const { id } = await context.params;
    const body = await request.json();

    await connectToDatabase();
    const loan = await LoanApplication.findById(id);

    if (!loan) {
      return NextResponse.json(
        { success: false, error: "Loan application not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const loanBranchId = String(loan.branchId);

    // Validate role permissions & field restrictions
    const permCheck = validateLoanUpdatePermissions(user, loanBranchId, body);
    if (!permCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: permCheck.reason || "Forbidden: Action not permitted for your role",
          code: "FORBIDDEN_ACTION",
        },
        { status: 403 }
      );
    }

    // Capture old values for audit trail
    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};

    // Apply allowed updates based on role
    if (user.role === "SUPERADMIN") {
      if ("status" in body && body.status !== loan.status) {
        loan.statusHistory = loan.statusHistory || [];
        loan.statusHistory.push({
          fromStatus: loan.status,
          toStatus: body.status,
          changedBy: new Types.ObjectId(user.id) as unknown as typeof loan.createdBy,
          changedByName: user.name,
          remarks:
            (body.statusRemarks as string) ||
            (body.adminRemarks as string) ||
            `Status updated from ${loan.status} to ${body.status}`,
          timestamp: new Date(),
        });
      }
      for (const [key, val] of Object.entries(body)) {
        if (key !== "_id" && key !== "createdAt" && key !== "createdBy" && key !== "statusHistory") {
          oldValue[key] = (loan as unknown as Record<string, unknown>)[key];
          (loan as unknown as Record<string, unknown>)[key] = val;
          loan.set(key, val);
          loan.markModified(key);
          newValue[key] = val;
        }
      }
      if ("parentName" in body) {
        const pName = typeof body.parentName === "string" ? body.parentName.trim() : "";
        loan.parentName = pName;
        loan.set("parentName", pName);
        loan.markModified("parentName");
        newValue.parentName = pName;
      }
      if ("cibilScore" in body) {
        const parsed =
          body.cibilScore === null || body.cibilScore === "" || isNaN(Number(body.cibilScore))
            ? null
            : Number(body.cibilScore);
        loan.cibilScore = parsed;
        loan.set("cibilScore", parsed);
        loan.markModified("cibilScore");
        newValue.cibilScore = parsed;
      }
    } else if (user.role === "ADMIN") {
      // Admin updates workflow status, admin remarks, parent name, cibil score, and processing stage
      if ("status" in body) {
        oldValue.status = loan.status;
        if (body.status !== loan.status) {
          loan.statusHistory = loan.statusHistory || [];
          loan.statusHistory.push({
            fromStatus: loan.status,
            toStatus: body.status,
            changedBy: new Types.ObjectId(user.id) as unknown as typeof loan.createdBy,
            changedByName: user.name,
            remarks:
              (body.statusRemarks as string) ||
              (body.adminRemarks as string) ||
              `Workflow status updated from ${loan.status} to ${body.status} by ${user.name}`,
            timestamp: new Date(),
          });
        }
        loan.status = body.status;
        loan.set("status", body.status);
        loan.markModified("status");
        newValue.status = body.status;
      }
      if ("adminRemarks" in body) {
        oldValue.adminRemarks = loan.adminRemarks;
        loan.adminRemarks = body.adminRemarks;
        loan.set("adminRemarks", body.adminRemarks);
        loan.markModified("adminRemarks");
        newValue.adminRemarks = body.adminRemarks;
      }
      if ("currentStage" in body) {
        oldValue.currentStage = loan.currentStage;
        loan.currentStage = body.currentStage;
        loan.set("currentStage", body.currentStage);
        loan.markModified("currentStage");
        newValue.currentStage = body.currentStage;
      }
      if ("parentName" in body) {
        oldValue.parentName = loan.parentName;
        const pName = typeof body.parentName === "string" ? body.parentName.trim() : "";
        loan.parentName = pName;
        loan.set("parentName", pName);
        loan.markModified("parentName");
        newValue.parentName = pName;
      }
      if ("cibilScore" in body) {
        oldValue.cibilScore = loan.cibilScore;
        const parsedCibil =
          body.cibilScore === null || body.cibilScore === "" || isNaN(Number(body.cibilScore))
            ? null
            : Number(body.cibilScore);
        loan.cibilScore = parsedCibil;
        loan.set("cibilScore", parsedCibil);
        loan.markModified("cibilScore");
        newValue.cibilScore = parsedCibil;
      }
    } else if (user.role === "BRANCH_USER") {
      // Branch user can NEVER modify parentName or cibilScore
      if ("parentName" in body || "cibilScore" in body) {
        return NextResponse.json(
          {
            success: false,
            error: "Forbidden: Branch users cannot change Parent Name or CIBIL Score. These details are filled by admin only and are strictly read-only for branch users.",
            code: "FORBIDDEN_ADMIN_FIELD",
          },
          { status: 403 }
        );
      }

      // Branch user updates branch remarks and application fields, but NEVER status or adminRemarks
      const branchEditableFields = [
        "studentName",
        "contactNumber",
        "email",
        "state",
        "pincode",
        "residentialAddress",
        "country",
        "universityCollege",
        "course",
        "courseDuration",
        "loanAmount",
        "neetScore",
        "coApplicantRelation",
        "coApplicantDetails",
        "intakeMonth",
        "intakeYear",
        "parentGuardianIncomeSource",
        "currentStage",
        "branchRemarks",
      ];

      for (const field of branchEditableFields) {
        if (field in body) {
          oldValue[field] = (loan as unknown as Record<string, unknown>)[field];
          (loan as unknown as Record<string, unknown>)[field] = body[field];
          loan.set(field, body[field]);
          loan.markModified(field);
          newValue[field] = body[field];
        }
      }
    }

    loan.updatedBy = user.id as unknown as typeof loan.updatedBy;
    await loan.save();

    // Direct MongoDB persistence safety net to guarantee parentName and cibilScore are saved in MongoDB
    if (user.role === "ADMIN" || user.role === "SUPERADMIN") {
      const directAdminUpdates: Record<string, unknown> = {};
      if ("parentName" in body) {
        directAdminUpdates.parentName = typeof body.parentName === "string" ? body.parentName.trim() : "";
      }
      if ("cibilScore" in body) {
        directAdminUpdates.cibilScore =
          body.cibilScore === null || body.cibilScore === "" || isNaN(Number(body.cibilScore))
            ? null
            : Number(body.cibilScore);
      }
      if (Object.keys(directAdminUpdates).length > 0) {
        await LoanApplication.collection.updateOne(
          { _id: new Types.ObjectId(id) },
          { $set: directAdminUpdates }
        );
      }
    }

    const updatedDoc = await LoanApplication.findById(id)
      .populate("branchId", "name code")
      .populate("createdBy", "name email role")
      .populate("updatedBy", "name email role")
      .lean();

    // Audit log update
    await logAuditEvent({
      userId: user.id,
      action: "LOAN_APPLICATION_UPDATED",
      entity: "LoanApplication",
      entityId: String(loan._id),
      oldValue,
      newValue,
      request,
    });

    return NextResponse.json({
      success: true,
      message: "Loan application updated successfully",
      data: updatedDoc,
    });
  } catch (err: unknown) {
    console.error("[loans:item:PATCH] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update loan record" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAuth(request);
    if ("status" in authResult) return authResult;
    const { user } = authResult;

    // RBAC: Superadmin ONLY
    if (!hasPermission(user.role, "loan:delete")) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden: Only Superadmin can delete loan applications",
          code: "FORBIDDEN_DELETE",
        },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    await connectToDatabase();
    const loan = await LoanApplication.findById(id);

    if (!loan) {
      return NextResponse.json(
        { success: false, error: "Loan application not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    await LoanApplication.findByIdAndDelete(id);

    // Audit log delete
    await logAuditEvent({
      userId: user.id,
      action: "LOAN_APPLICATION_DELETED",
      entity: "LoanApplication",
      entityId: id,
      oldValue: {
        sdmId: loan.sdmId,
        studentName: loan.studentName,
        branchId: String(loan.branchId),
        status: loan.status,
      },
      request,
    });

    return NextResponse.json({
      success: true,
      message: "Loan application permanently deleted",
    });
  } catch (err: unknown) {
    console.error("[loans:item:DELETE] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to delete loan record" },
      { status: 500 }
    );
  }
}
