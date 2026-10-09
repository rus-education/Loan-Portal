import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { requireRole, hashPassword } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

export async function POST(request: NextRequest, context: RouteContext) {
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
    const parsed = resetPasswordSchema.safeParse(body);

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

    const passwordHash = await hashPassword(parsed.data.newPassword);
    targetUser.passwordHash = passwordHash;
    await targetUser.save();

    await logAuditEvent({
      userId: currentSuperadmin.id,
      action: "PASSWORD_RESET",
      entity: "User",
      entityId: id,
      newValue: { targetUserEmail: targetUser.email },
      request,
    });

    return NextResponse.json({
      success: true,
      message: `Password for '${targetUser.name}' has been reset successfully.`,
    });
  } catch (err: unknown) {
    console.error("[users:reset-password:POST] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to reset password" },
      { status: 500 }
    );
  }
}
