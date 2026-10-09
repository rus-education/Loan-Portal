import { NextRequest, NextResponse } from "next/server";

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// In-memory sliding window store
const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up stale records periodically every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const existing = rateLimitStore.get(key);

  if (!existing || now > existing.resetTime) {
    const resetTime = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetTime });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: Math.ceil(resetTime / 1000),
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetTime - now) / 1000));
    return {
      success: false,
      limit,
      remaining: 0,
      reset: Math.ceil(existing.resetTime / 1000),
      retryAfterSeconds,
    };
  }

  existing.count += 1;
  return {
    success: true,
    limit,
    remaining: Math.max(0, limit - existing.count),
    reset: Math.ceil(existing.resetTime / 1000),
    retryAfterSeconds: 0,
  };
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "127.0.0.1";
}

/**
 * Rate limit authentication attempts (e.g. login)
 * Default: 10 attempts per 60 seconds per IP/account
 */
export function rateLimitAuth(
  request: NextRequest,
  identifier?: string,
  limit: number = 10,
  windowMs: number = 60 * 1000
): RateLimitResult {
  const ip = getClientIp(request);
  const key = `auth:${ip}:${identifier || "global"}`;
  return checkRateLimit(key, limit, windowMs);
}

/**
 * Standard HTTP 429 response helper
 */
export function createRateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: `Too many requests. Please wait ${result.retryAfterSeconds} seconds before retrying.`,
      code: "RATE_LIMIT_EXCEEDED",
      retryAfter: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.reset),
      },
    }
  );
}

/**
 * Helper to reset rate limit on successful authentication
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}
