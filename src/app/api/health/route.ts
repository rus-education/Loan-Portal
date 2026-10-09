import { NextResponse } from "next/server";
import { getDatabaseStatus } from "@/lib/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  const dbStatus = await getDatabaseStatus();
  const duration = Date.now() - startTime;

  return NextResponse.json(
    {
      status: dbStatus.connected ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      service: env.NEXT_PUBLIC_APP_NAME,
      environment: env.NODE_ENV,
      database: {
        ...dbStatus,
        responseTimeMs: duration,
      },
      uptime: process.uptime(),
    },
    {
      status: dbStatus.connected ? 200 : 503,
    }
  );
}
