import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const AUTH_COOKIE_NAME = "loan_portal_session";
const JWT_SECRET_STRING = process.env.JWT_SECRET || "loan-portal-production-secret-key-32-chars-minimum-entropy-2026";
const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET_STRING);

// Routes that do not require authentication
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/health",
  "/api/seed",
  "/favicon.ico",
];

// Superadmin only frontend paths and user/system management API
const SUPERADMIN_PATHS = [
  "/branches",
  "/users",
  "/api/users",
  "/settings",
  "/api/settings",
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

  // 7. Role-based route guard for SUPERADMIN areas
  const userRole = String(payload.role || "");
  const isSuperAdminOnly = SUPERADMIN_PATHS.some((path) => pathname === path || pathname.startsWith(path + "/"));

  if (isSuperAdminOnly && userRole !== "SUPERADMIN") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Superadmin access required", code: "FORBIDDEN" },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 8. Forward request with user context in headers
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
