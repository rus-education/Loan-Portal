import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { Branch } from "@/models/Branch";
import { requireRole, hashPassword } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required").trim(),
  email: z.string().email("Invalid email").toLowerCase().trim(),
  phone: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["SUPERADMIN", "ADMIN", "BRANCH_USER", "VIEWER"]),
  branchId: z.string().nullable().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

export async function GET(request: NextRequest) {
  try {
    // Only SUPERADMIN can manage users
    const authResult = await requireRole(request, ["SUPERADMIN"]);
    if ("status" in authResult) return authResult;

    await connectToDatabase();
    const searchParams = request.nextUrl.searchParams;
    const roleParam = searchParams.get("role");
    const branchParam = searchParams.get("branchId");
    const statusParam = searchParams.get("status");
    const search = searchParams.get("search");

    const filter: Record<string, unknown> = {};
    if (roleParam && roleParam !== "ALL") filter.role = roleParam;
    if (branchParam && branchParam !== "ALL") filter.branchId = branchParam;
    if (statusParam && statusParam !== "ALL") filter.status = statusParam;

    if (search?.trim()) {
      const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const reg = { $regex: escapeRegex(search.trim()), $options: "i" };
      filter.$or = [{ name: reg }, { email: reg }, { phone: reg }];
    }

    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");

    const query = User.find(filter)
      .populate("branchId", "name code status")
      .select("-passwordHash")
      .sort({ createdAt: -1 });

    if (pageParam !== null) {
      const page = Math.max(1, parseInt(pageParam || "1", 10));
      const limit = Math.min(100, Math.max(1, parseInt(limitParam || "50", 10)));
      const skip = (page - 1) * limit;

      const [users, total] = await Promise.all([
        query.skip(skip).limit(limit).lean(),
        User.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(total / limit);

      return NextResponse.json({
        success: true,
        data: users,
        count: users.length,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      });
    }

    const users = await query.lean();

    return NextResponse.json({
      success: true,
      data: users,
      count: users.length,
    });
  } catch (err: unknown) {
    console.error("[users:GET] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRole(request, ["SUPERADMIN"]);
    if ("status" in authResult) return authResult;
    const { user: currentSuperadmin } = authResult;

    await connectToDatabase();
    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check unique email
    const existing = await User.findOne({ email: data.email });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "A user with this email address already exists" },
        { status: 409 }
      );
    }

    // If role is BRANCH_USER, branchId is required
    if (data.role === "BRANCH_USER" && !data.branchId) {
      return NextResponse.json(
        { success: false, error: "Branch users must be assigned to an active branch" },
        { status: 400 }
      );
    }

    if (data.branchId) {
      const branchExists = await Branch.findById(data.branchId);
      if (!branchExists) {
        return NextResponse.json(
          { success: false, error: "Specified branch not found" },
          { status: 400 }
        );
      }
    }

    const passwordHash = await hashPassword(data.password);

    const newUser = await User.create({
      name: data.name,
      email: data.email,
      phone: data.phone || "",
      passwordHash,
      role: data.role,
      branchId: data.branchId || null,
      status: data.status,
    });

    const populated = await User.findById(newUser._id)
      .populate("branchId", "name code")
      .select("-passwordHash");

    // Audit log
    await logAuditEvent({
      userId: currentSuperadmin.id,
      action: "USER_CREATED",
      entity: "User",
      entityId: String(newUser._id),
      newValue: {
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        branchId: newUser.branchId,
        status: newUser.status,
      },
      request,
    });

    return NextResponse.json(
      {
        success: true,
        message: `User '${newUser.name}' created successfully`,
        data: populated,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("[users:POST] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to create user" },
      { status: 500 }
    );
  }
}
