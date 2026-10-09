import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { AuditLog } from "@/models/AuditLog";
import type { Types } from "mongoose";

export interface LogAuditOptions {
  userId?: string | Types.ObjectId | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  request?: NextRequest;
  ip?: string;
  userAgent?: string;
}

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "password_hash",
  "token",
  "jwt",
  "secret",
  "authorization",
  "cookie",
]);

function sanitizeAuditData(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data)) {
    return data.map(sanitizeAuditData);
  }
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeAuditData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export async function logAuditEvent(options: LogAuditOptions): Promise<void> {
  try {
    await connectToDatabase();

    let clientIp = options.ip || "";
    let userAgent = options.userAgent || "";

    if (options.request) {
      const forwarded = options.request.headers.get("x-forwarded-for");
      clientIp = forwarded ? forwarded.split(",")[0].trim() : options.request.headers.get("x-real-ip") || "";
      userAgent = options.request.headers.get("user-agent") || "";
    }

    await AuditLog.create({
      userId: options.userId || null,
      action: options.action,
      entity: options.entity,
      entityId: options.entityId ? String(options.entityId) : null,
      oldValue: sanitizeAuditData(options.oldValue) || null,
      newValue: sanitizeAuditData(options.newValue) || null,
      ip: clientIp,
      userAgent: userAgent,
      timestamp: new Date(),
    });
  } catch (err) {
    // Non-blocking error logging for audit logs to prevent breaking primary transaction
    console.error("[audit] Failed to record audit log:", err);
  }
}
