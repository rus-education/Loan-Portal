import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { Branch } from "@/models/Branch";
import { User } from "@/models/User";
import { LoanApplication } from "@/models/LoanApplication";
import { requireAuth, requireRole } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const updateBranchSchema = z.object({
  name: z.string().min(1, "Branch name is required").trim().optional(),
  code: z.string().min(2, "Branch code must be at least 2 characters").toUpperCase().trim().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAuth(request);
    if ("status" in authResult) return authResult;

    const { id } = await context.params;
    await connectToDatabase();

    const branch = await Branch.findById(id).lean();
    if (!branch) {
      return NextResponse.json(
        { success: false, error: "Branch not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Fetch assigned users and application stats
    const [assignedUsers, loanStats] = await Promise.all([
      User.find({ branchId: id }).select("-passwordHash").lean(),
      LoanApplication.aggregate([
        { $match: { branchId: branch._id } },
        {
          $group: {
            _id: "$branchId",
            totalLoans: { $sum: 1 },
            totalAmount: { $sum: "$loanAmount" },
            pendingCount: {
              $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] },
            },
            approvedCount: {
              $sum: { $cond: [{ $eq: ["$status", "Approved"] }, 1, 0] },
            },
            completedCount: {
              $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const stats = loanStats[0] || {
      totalLoans: 0,
      totalAmount: 0,
      pendingCount: 0,
      approvedCount: 0,
      completedCount: 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        ...branch,
        users: assignedUsers,
        stats,
      },
    });
  } catch (err: unknown) {
    console.error("[branches:item:GET] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve branch details" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    // Only SUPERADMIN can modify branches
    const authResult = await requireRole(request, ["SUPERADMIN"]);
    if ("status" in authResult) return authResult;
    const { user: currentSuperadmin } = authResult;

    const { id } = await context.params;
    await connectToDatabase();

    const branch = await Branch.findById(id);
    if (!branch) {
      return NextResponse.json(
        { success: false, error: "Branch not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = updateBranchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, code, status } = parsed.data;

    // If code is being changed, check uniqueness
    if (code && code !== branch.code) {
      const existing = await Branch.findOne({ code, _id: { $ne: id } });
      if (existing) {
        return NextResponse.json(
          { success: false, error: `Branch code '${code}' is already in use` },
          { status: 409 }
        );
      }
    }

    const oldValue: Record<string, unknown> = {
      name: branch.name,
      code: branch.code,
      status: branch.status,
    };

    const isStatusChangeOnly =
      status !== undefined && status !== branch.status && !name && !code;

    if (name) branch.name = name;
    if (code) branch.code = code;
    if (status) branch.status = status;

    await branch.save();

    const newValue: Record<string, unknown> = {
      name: branch.name,
      code: branch.code,
      status: branch.status,
    };

    // Log audit event
    await logAuditEvent({
      userId: currentSuperadmin.id,
      action: isStatusChangeOnly ? "BRANCH_STATUS_CHANGED" : "BRANCH_UPDATED",
      entity: "Branch",
      entityId: String(branch._id),
      oldValue,
      newValue,
      request,
    });

    return NextResponse.json({
      success: true,
      message: `Branch '${branch.name}' updated successfully`,
      data: branch,
    });
  } catch (err: unknown) {
    console.error("[branches:item:PATCH] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update branch" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    // Only SUPERADMIN can delete/deactivate branches
    const authResult = await requireRole(request, ["SUPERADMIN"]);
    if ("status" in authResult) return authResult;
    const { user: currentSuperadmin } = authResult;

    const { id } = await context.params;
    await connectToDatabase();

    const branch = await Branch.findById(id);
    if (!branch) {
      return NextResponse.json(
        { success: false, error: "Branch not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Safety guard: Check if loan applications are linked to this branch
    const loanCount = await LoanApplication.countDocuments({ branchId: id });
    if (loanCount > 0) {
      // Instead of hard delete, deactivate the branch to preserve referential integrity
      branch.status = "inactive";
      await branch.save();

      await logAuditEvent({
        userId: currentSuperadmin.id,
        action: "BRANCH_STATUS_CHANGED",
        entity: "Branch",
        entityId: id,
        oldValue: { status: "active" },
        newValue: { status: "inactive", reason: "Deactivated due to existing linked loan records" },
        request,
      });

      return NextResponse.json({
        success: true,
        message: `Branch has ${loanCount} linked loan applications. Branch status set to inactive to preserve records.`,
        deactivated: true,
      });
    }

    // If no loans, delete branch
    await Branch.findByIdAndDelete(id);

    await logAuditEvent({
      userId: currentSuperadmin.id,
      action: "BRANCH_DELETED",
      entity: "Branch",
      entityId: id,
      oldValue: { name: branch.name, code: branch.code },
      request,
    });

    return NextResponse.json({
      success: true,
      message: `Branch '${branch.name}' permanently deleted.`,
    });
  } catch (err: unknown) {
    console.error("[branches:item:DELETE] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to delete branch" },
      { status: 500 }
    );
  }
}
