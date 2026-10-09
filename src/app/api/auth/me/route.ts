import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { Branch } from "@/models/Branch";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser(request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    await connectToDatabase();
    const userDoc = await User.findById(session.id).lean();

    if (!userDoc || userDoc.status !== "active") {
      return NextResponse.json(
        { success: false, error: "Account inactive or not found", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    let branchName: string | null = null;
    if (userDoc.branchId) {
      const branch = await Branch.findById(userDoc.branchId).lean();
      if (branch) branchName = branch.name;
    }

    return NextResponse.json({
      success: true,
      user: {
        id: String(userDoc._id),
        name: userDoc.name,
        email: userDoc.email,
        phone: userDoc.phone || "",
        role: userDoc.role,
        branchId: userDoc.branchId ? String(userDoc.branchId) : null,
        branchName: branchName,
        status: userDoc.status,
        lastLogin: userDoc.lastLogin || null,
        createdAt: userDoc.createdAt,
      },
    });
  } catch (err: unknown) {
    console.error("[auth] Session check error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to verify session" },
      { status: 500 }
    );
  }
}
