import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { Branch } from "@/models/Branch";
import { requireRole } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required").trim().optional(),
  email: z.string().email("Invalid email").toLowerCase().trim().optional(),
  phone: z.string().optional(),
  role: z.enum(["SUPERADMIN", "ADMIN", "BRANCH_USER", "VIEWER"]).optional(),
  branchId: z.string().nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireRole(request, ["SUPERADMIN"]);
    if ("status" in authResult) return authResult;

    const { id } = await context.params;
    await connectToDatabase();

    const user = await User.findById(id)
      .populate("branchId", "name code status")
      .select("-passwordHash")
      .lean();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (err: unknown) {
    console.error("[users:item:GET] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireRole(request, ["SUPERADMIN"]);
    if ("status" in authResult) return authResult;
    const { user: currentSuperadmin } = authResult;

    const { id } = await context.params;
    await connectToDatabase();

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: "User not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);

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

    const data = parsed.data;

    // Self-action guards
    const isSelf = String(currentSuperadmin.id) === String(targetUser._id);
    if (isSelf) {
      if (data.status === "inactive") {
        return NextResponse.json(
          { success: false, error: "You cannot deactivate your own administrative account" },
          { status: 400 }
        );
      }
      if (data.role && data.role !== "SUPERADMIN") {
        return NextResponse.json(
          { success: false, error: "You cannot revoke your own SuperAdmin privileges" },
          { status: 400 }
        );
      }
    }

    // Email uniqueness check if email changed
    if (data.email && data.email !== targetUser.email) {
      const existing = await User.findOne({ email: data.email, _id: { $ne: id } });
      if (existing) {
        return NextResponse.json(
          { success: false, error: "Email address is already in use by another user" },
          { status: 409 }
        );
      }
    }

    // Branch assignment validation
    const resultingRole = data.role || targetUser.role;
    let resultingBranchId = data.branchId !== undefined ? data.branchId : targetUser.branchId;

    if (resultingRole === "BRANCH_USER" && !resultingBranchId) {
      return NextResponse.json(
        { success: false, error: "Branch users must be assigned to an active branch" },
        { status: 400 }
      );
    }

    if (resultingBranchId) {
      const branchExists = await Branch.findById(resultingBranchId);
      if (!branchExists) {
        return NextResponse.json(
          { success: false, error: "Specified branch not found" },
          { status: 400 }
        );
      }
    }

    // If role changed away from BRANCH_USER, clear branchId if null was provided
    if (resultingRole !== "BRANCH_USER" && data.branchId === null) {
      resultingBranchId = null;
    }

    // Capture old values for audit
    const oldValue: Record<string, unknown> = {
      name: targetUser.name,
      email: targetUser.email,
      phone: targetUser.phone,
      role: targetUser.role,
      branchId: targetUser.branchId ? String(targetUser.branchId) : null,
      status: targetUser.status,
    };

    const isRoleChanged = data.role && data.role !== targetUser.role;
    const isStatusChanged = data.status && data.status !== targetUser.status;

    if (data.name) targetUser.name = data.name;
    if (data.email) targetUser.email = data.email;
    if (data.phone !== undefined) targetUser.phone = data.phone;
    if (data.role) targetUser.role = data.role;
    if (data.branchId !== undefined) targetUser.branchId = data.branchId as unknown as typeof targetUser.branchId;
    if (data.status) targetUser.status = data.status;

    await targetUser.save();

    const newValue: Record<string, unknown> = {
      name: targetUser.name,
      email: targetUser.email,
      phone: targetUser.phone,
      role: targetUser.role,
      branchId: targetUser.branchId ? String(targetUser.branchId) : null,
      status: targetUser.status,
    };

    // Determine audit action
    let auditAction = "USER_UPDATED";
    if (isRoleChanged) {
      auditAction = "ROLE_CHANGED";
    } else if (isStatusChanged) {
      auditAction = "USER_STATUS_CHANGED";
    }

    await logAuditEvent({
      userId: currentSuperadmin.id,
      action: auditAction,
      entity: "User",
      entityId: String(targetUser._id),
      oldValue,
      newValue,
      request,
    });

    const populated = await User.findById(targetUser._id)
      .populate("branchId", "name code status")
      .select("-passwordHash");

    return NextResponse.json({
      success: true,
      message: `User '${targetUser.name}' updated successfully`,
      data: populated,
    });
  } catch (err: unknown) {
    console.error("[users:item:PATCH] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update user" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireRole(request, ["SUPERADMIN"]);
    if ("status" in authResult) return authResult;
    const { user: currentSuperadmin } = authResult;

    const { id } = await context.params;
    await connectToDatabase();

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: "User not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Prevent self-deletion
    if (String(currentSuperadmin.id) === String(targetUser._id)) {
      return NextResponse.json(
        { success: false, error: "You cannot delete your own active administrator account" },
        { status: 400 }
      );
    }

    await User.findByIdAndDelete(id);

    await logAuditEvent({
      userId: currentSuperadmin.id,
      action: "USER_DELETED",
      entity: "User",
      entityId: id,
      oldValue: {
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        branchId: targetUser.branchId,
      },
      request,
    });

    return NextResponse.json({
      success: true,
      message: `User '${targetUser.name}' has been permanently deleted.`,
    });
  } catch (err: unknown) {
    console.error("[users:item:DELETE] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
