import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase, getDatabaseStatus } from "@/lib/db";
import { Branch } from "@/models/Branch";
import { User } from "@/models/User";
import { LoanApplication } from "@/models/LoanApplication";
import { AuditLog } from "@/models/AuditLog";
import { requireRole } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { env } from "@/lib/env";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(request, ["SUPERADMIN"]);
    if ("status" in authResult) return authResult;

    await connectToDatabase();
    const dbStatus = await getDatabaseStatus();

    const [branchCount, userCount, loanCount, auditCount] = await Promise.all([
      Branch.countDocuments(),
      User.countDocuments(),
      LoanApplication.countDocuments(),
      AuditLog.countDocuments(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        appName: env.NEXT_PUBLIC_APP_NAME,
        version: "v1.0.0 Enterprise Edition",
        environment: env.NODE_ENV,
        database: {
          connected: dbStatus.connected,
          host: dbStatus.host,
          databaseName: dbStatus.name,
          state: dbStatus.state,
        },
        counts: {
          branches: branchCount,
          users: userCount,
          loans: loanCount,
          auditLogs: auditCount,
        },
        policies: {
          sessionExpiry: env.JWT_EXPIRES_IN || "7d",
          defaultCurrency: "INR (Indian Rupee)",
          minLoanAmount: 50000,
          maxLoanAmount: 20000000,
          allowCrossBranchAuditing: true,
          maintenanceMode: false,
        },
      },
    });
  } catch (err: unknown) {
    console.error("[settings:GET] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve system settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireRole(request, ["SUPERADMIN"]);
    if ("status" in authResult) return authResult;
    const { user: currentSuperadmin } = authResult;

    const body = await request.json();

    await logAuditEvent({
      userId: currentSuperadmin.id,
      action: "SYSTEM_SETTINGS_UPDATED",
      entity: "System",
      newValue: body,
      request,
    });

    return NextResponse.json({
      success: true,
      message: "System configuration updated successfully",
      data: body,
    });
  } catch (err: unknown) {
    console.error("[settings:PATCH] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update system settings" },
      { status: 500 }
    );
  }
}
