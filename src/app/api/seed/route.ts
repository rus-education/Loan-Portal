import { NextRequest, NextResponse } from "next/server";
import { runDatabaseSeed } from "@/lib/seed";
import { env } from "@/lib/env";
import { getSessionUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  // In production, strictly enforce SuperAdmin authorization
  if (env.NODE_ENV === "production") {
    const user = await getSessionUser(request);
    if (!user || user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { success: false, error: "Unauthorized: SuperAdmin credentials required to seed in production" },
        { status: 403 }
      );
    }
  }

  try {
    const seedResult = await runDatabaseSeed();
    return NextResponse.json(seedResult, { status: 200 });
  } catch (err: unknown) {
    console.error("[seed] Error seeding database:", err);
    const msg = err instanceof Error ? err.message : "Database seeding failed";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // Allow GET only in development or with SuperAdmin session
  if (env.NODE_ENV !== "development") {
    const user = await getSessionUser(request);
    if (!user || user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { success: false, error: "Seed GET route only accessible in development or by SuperAdmin" },
        { status: 403 }
      );
    }
  }

  try {
    const seedResult = await runDatabaseSeed();
    return NextResponse.json(seedResult, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Database seeding failed";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
