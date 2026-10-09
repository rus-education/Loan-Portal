import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { AuditLog } from "@/models/AuditLog";
import { requireRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    // Only SUPERADMIN and ADMIN can view audit logs
    const authResult = await requireRole(request, ["SUPERADMIN", "ADMIN"]);
    if ("status" in authResult) return authResult;

    await connectToDatabase();

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get("action");
    const entity = searchParams.get("entity");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (action) filter.action = action;
    if (entity) filter.entity = entity;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate("userId", "name email role")
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: unknown) {
    console.error("[audit-logs:GET] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
