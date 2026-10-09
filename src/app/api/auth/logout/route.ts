import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookie, getSessionUser } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);

    if (user) {
      await logAuditEvent({
        userId: user.id,
        action: "USER_LOGOUT",
        entity: "Auth",
        entityId: user.id,
        request,
      });
    }

    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });

    clearAuthCookie(response);
    return response;
  } catch (err: unknown) {
    console.error("[auth] Logout error:", err);
    const response = NextResponse.json({ success: true, message: "Logged out" });
    clearAuthCookie(response);
    return response;
  }
}
