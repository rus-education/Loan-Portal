import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import type { UserRole, UserSession } from "@/types";

const JWT_SECRET_KEY = new TextEncoder().encode(env.JWT_SECRET);
export const AUTH_COOKIE_NAME = "loan_portal_session";

export interface TokenPayload {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  branchId?: string | null;
  branchName?: string | null;
  [key: string]: unknown;
}

// ----------------------------------------------------
// Password Security (bcryptjs)
// ----------------------------------------------------
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}

// ----------------------------------------------------
// JWT Token Handling (jose)
// ----------------------------------------------------
export async function createAuthToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN || "7d")
    .sign(JWT_SECRET_KEY);
}

export async function verifyAuthToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

// ----------------------------------------------------
// Cookie Management
// ----------------------------------------------------
export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

// ----------------------------------------------------
// Server-side Session Extraction
// ----------------------------------------------------
export async function getSessionUser(request?: NextRequest): Promise<UserSession | null> {
  let token: string | undefined;

  if (request) {
    // 1. Check HTTP-only cookie
    token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

    // 2. Fallback to Authorization Header
    if (!token) {
      const authHeader = request.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }
  } else {
    // Read from next/headers cookies store in Server Components / Server Actions
    const cookieStore = await cookies();
    token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  }

  if (!token) return null;

  const payload = await verifyAuthToken(token);
  if (!payload) return null;

  return {
    id: payload.userId,
    name: payload.name,
    email: payload.email,
    role: payload.role,
    branchId: payload.branchId || null,
    branchName: payload.branchName || null,
    isActive: true,
  };
}

// ----------------------------------------------------
// Role-Aware RBAC Helpers for Route Handlers
// ----------------------------------------------------
export async function requireAuth(
  request: NextRequest
): Promise<{ user: UserSession } | NextResponse> {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Authentication required", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }
  return { user };
}

export async function requireRole(
  request: NextRequest,
  allowedRoles: UserRole[]
): Promise<{ user: UserSession } | NextResponse> {
  const authResult = await requireAuth(request);
  if ("user" in authResult) {
    if (!allowedRoles.includes(authResult.user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: `Forbidden: role '${authResult.user.role}' lacks sufficient privileges`,
          code: "FORBIDDEN",
        },
        { status: 403 }
      );
    }
    return authResult;
  }
  return authResult;
}

/**
 * Validates whether the user can access a specific branch's resource (prevents IDOR).
 * - SUPERADMIN & ADMIN: Can access any branch.
 * - VIEWER: Read-only access across branches.
 * - BRANCH_USER: Strictly locked to their own branchId.
 */
export function assertBranchAccess(
  user: UserSession,
  targetBranchId: string
): { allowed: boolean; reason?: string } {
  if (user.role === "SUPERADMIN" || user.role === "ADMIN" || user.role === "VIEWER") {
    return { allowed: true };
  }

  if (user.role === "BRANCH_USER") {
    if (!user.branchId) {
      return { allowed: false, reason: "Branch user is not associated with any branch" };
    }
    if (String(user.branchId) !== String(targetBranchId)) {
      return { allowed: false, reason: "Access denied to unauthorized branch records" };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: "Unknown user role" };
}
