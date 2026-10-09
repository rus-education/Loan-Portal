import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { Branch } from "@/models/Branch";
import { verifyPassword, createAuthToken, setAuthCookie } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { rateLimitAuth, createRateLimitResponse, resetRateLimit, getClientIp } from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    // 1. Rate Limiting Check (10 attempts per minute per IP / email)
    const clientIdentifier = body?.email ? String(body.email).toLowerCase().trim() : undefined;
    const rateCheck = rateLimitAuth(request, clientIdentifier, 10, 60 * 1000);
    if (!rateCheck.success) {
      await logAuditEvent({
        action: "LOGIN_RATE_LIMITED",
        entity: "Auth",
        oldValue: { email: clientIdentifier, retryAfter: rateCheck.retryAfterSeconds },
        request,
      });
      return createRateLimitResponse(rateCheck);
    }

    await connectToDatabase();
    const parsed = loginSchema.safeParse(body);

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

    const { email, password } = parsed.data;

    // Find user with passwordHash
    const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");

    if (!user) {
      await logAuditEvent({
        action: "LOGIN_FAILED",
        entity: "Auth",
        oldValue: { email, reason: "User not found" },
        request,
      });

      return NextResponse.json(
        { success: false, error: "Invalid email or password", code: "INVALID_CREDENTIALS" },
        { status: 401 }
      );
    }

    if (user.status !== "active") {
      await logAuditEvent({
        userId: user._id,
        action: "LOGIN_REJECTED_INACTIVE",
        entity: "Auth",
        oldValue: { email, status: user.status },
        request,
      });

      return NextResponse.json(
        {
          success: false,
          error: "Your account is deactivated. Please contact an administrator.",
          code: "ACCOUNT_DEACTIVATED",
        },
        { status: 403 }
      );
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      await logAuditEvent({
        userId: user._id,
        action: "LOGIN_FAILED_PASSWORD",
        entity: "Auth",
        oldValue: { email, reason: "Invalid password" },
        request,
      });

      return NextResponse.json(
        { success: false, error: "Invalid email or password", code: "INVALID_CREDENTIALS" },
        { status: 401 }
      );
    }

    // Resolve branch name if applicable
    let branchName: string | undefined;
    if (user.branchId) {
      const branch = await Branch.findById(user.branchId).lean();
      if (branch) branchName = branch.name;
    }

    // Update last login timestamp
    user.lastLogin = new Date();
    await user.save();

    // Create session token
    const token = await createAuthToken({
      userId: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      branchId: user.branchId ? String(user.branchId) : null,
      branchName: branchName || null,
    });

    const response = NextResponse.json({
      success: true,
      message: "Login successful",
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        branchId: user.branchId ? String(user.branchId) : null,
        branchName: branchName || null,
      },
    });

    // Set secure HTTP-only cookie
    setAuthCookie(response, token);

    // Reset rate limit counter on valid credentials
    resetRateLimit(`auth:${getClientIp(request)}:${email.toLowerCase()}`);

    // Audit log
    await logAuditEvent({
      userId: user._id,
      action: "USER_LOGIN",
      entity: "Auth",
      entityId: String(user._id),
      newValue: { role: user.role, branchName: branchName || null },
      request,
    });

    return response;
  } catch (err: unknown) {
    console.error("[auth] Login error:", err);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred during login" },
      { status: 500 }
    );
  }
}
