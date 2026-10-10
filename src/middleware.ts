import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const AUTH_COOKIE_NAME = "loan_portal_session";
const rawSecret = (process.env.JWT_SECRET || "").trim().replace(/^["']|["']$/g, "");
const JWT_SECRET_STRING = rawSecret && rawSecret.length >= 16 ? rawSecret : "loan-portal-production-secret-key-32-chars-minimum-entropy-2026";
const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET_STRING);

// Routes that do not require authentication
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/health",
  "/api/seed",
  "/favicon.ico",
];

// Superadmin only frontend paths and management APIs
const SUPERADMIN_ONLY_PATHS = [
  "/branches",
  "/users",
  "/api/users",
  "/settings",
  "/api/settings",
];

// Admin & Superadmin analytics and audit trails
const ADMIN_OR_SUPERADMIN_PATHS = [
  "/analytics",
  "/api/analytics",
  "/audit-logs",
  "/api/audit-logs",
];

// Loan creation is restricted to SuperAdmin and Branch Officers
const LOAN_CREATION_PATHS = [
  "/loans/new",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow public static assets and Next internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/public") ||
    pathname.includes(".") // static files like .ico, .png, etc.
  ) {
    return NextResponse.next();
  }

  // 2. Check if route is public
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + "/"));

  // 3. Extract token from cookie or header
  const token =
    request.cookies.get(AUTH_COOKIE_NAME)?.value ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  let payload: Record<string, unknown> | null = null;
  if (token) {
    try {
      const verified = await jwtVerify(token, JWT_SECRET_KEY);
      payload = verified.payload as Record<string, unknown>;
    } catch {
      payload = null;
    }
  }

  // 4. Handle authenticated users visiting /login
  if (pathname === "/login") {
    if (payload) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // 5. Allow other public routes
  if (isPublic) {
    return NextResponse.next();
  }

  // 6. If not authenticated:
  if (!payload) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Authentication required", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const userRole = String(payload.role || "");

  // 7. Role Guard: SUPERADMIN ONLY
  const isSuperAdminPath = SUPERADMIN_ONLY_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );
  if (isSuperAdminPath && userRole !== "SUPERADMIN") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Superadmin access required", code: "FORBIDDEN_SUPERADMIN_REQUIRED" },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 8. Role Guard: ADMIN OR SUPERADMIN ONLY (Analytics & Audit Logs)
  const isAdminOrSuperPath = ADMIN_OR_SUPERADMIN_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );
  if (isAdminOrSuperPath && userRole !== "SUPERADMIN" && userRole !== "ADMIN") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Administrative access required", code: "FORBIDDEN_ADMIN_REQUIRED" },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 9. Role Guard: Loan Creation (/loans/new)
  const isLoanCreationPath = LOAN_CREATION_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );
  if (isLoanCreationPath && userRole !== "SUPERADMIN" && userRole !== "BRANCH_USER") {
    return NextResponse.redirect(new URL("/loans", request.url));
  }

  // 10. Forward request with trusted user context in headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", String(payload.userId || ""));
  requestHeaders.set("x-user-role", userRole);
  if (payload.branchId) {
    requestHeaders.set("x-user-branch-id", String(payload.branchId));
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
