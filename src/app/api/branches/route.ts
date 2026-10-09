import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { Branch } from "@/models/Branch";
import { User } from "@/models/User";
import { LoanApplication } from "@/models/LoanApplication";
import { requireAuth, requireRole } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

const createBranchSchema = z.object({
  name: z.string().min(1, "Branch name is required").trim(),
  code: z.string().min(2, "Branch code must be at least 2 characters").toUpperCase().trim(),
  status: z.enum(["active", "inactive"]).default("active"),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if ("status" in authResult) return authResult;

    await connectToDatabase();
    const searchParams = request.nextUrl.searchParams;
    const statusParam = searchParams.get("status");
    const search = searchParams.get("search");
    const includeStats = searchParams.get("includeStats") === "true";

    const filter: Record<string, unknown> = {};
    if (statusParam && statusParam !== "all") {
      filter.status = statusParam;
    }
    if (search?.trim()) {
      const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const reg = { $regex: escapeRegex(search.trim()), $options: "i" };
      filter.$or = [{ name: reg }, { code: reg }];
    }

    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");

    if (pageParam !== null && !includeStats) {
      const page = Math.max(1, parseInt(pageParam || "1", 10));
      const limit = Math.min(100, Math.max(1, parseInt(limitParam || "50", 10)));
      const skip = (page - 1) * limit;

      const [pagedBranches, total] = await Promise.all([
        Branch.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
        Branch.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(total / limit);

      return NextResponse.json({
        success: true,
        data: pagedBranches,
        count: pagedBranches.length,
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

    const branches = await Branch.find(filter).sort({ name: 1 }).lean();

    if (!includeStats) {
      return NextResponse.json({
        success: true,
        data: branches,
        count: branches.length,
      });
    }

    // Calculate aggregated statistics per branch
    const branchIds = branches.map((b) => b._id);

    const [userCounts, loanStats] = await Promise.all([
      User.aggregate([
        { $match: { branchId: { $in: branchIds } } },
        { $group: { _id: "$branchId", count: { $sum: 1 } } },
      ]),
      LoanApplication.aggregate([
        { $match: { branchId: { $in: branchIds } } },
        {
          $group: {
            _id: "$branchId",
            count: { $sum: 1 },
            totalAmount: { $sum: "$loanAmount" },
            pendingCount: {
              $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] },
            },
            approvedCount: {
              $sum: { $cond: [{ $eq: ["$status", "Approved"] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const userCountMap = new Map<string, number>();
    for (const uc of userCounts) {
      if (uc._id) userCountMap.set(String(uc._id), uc.count);
    }

    const loanStatsMap = new Map<
      string,
      { count: number; totalAmount: number; pendingCount: number; approvedCount: number }
    >();
    for (const ls of loanStats) {
      if (ls._id) {
        loanStatsMap.set(String(ls._id), {
          count: ls.count,
          totalAmount: ls.totalAmount,
          pendingCount: ls.pendingCount,
          approvedCount: ls.approvedCount,
        });
      }
    }

    const enrichedBranches = branches.map((b) => {
      const bId = String(b._id);
      const ls = loanStatsMap.get(bId) || { count: 0, totalAmount: 0, pendingCount: 0, approvedCount: 0 };
      return {
        ...b,
        userCount: userCountMap.get(bId) || 0,
        loanCount: ls.count,
        totalLoanAmount: ls.totalAmount,
        pendingLoanCount: ls.pendingCount,
        approvedLoanCount: ls.approvedCount,
      };
    });

    return NextResponse.json({
      success: true,
      data: enrichedBranches,
      count: enrichedBranches.length,
    });
  } catch (err: unknown) {
    console.error("[branches:GET] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch branches" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Only SUPERADMIN can create branches
    const authResult = await requireRole(request, ["SUPERADMIN"]);
    if ("status" in authResult) return authResult;
    const { user: currentSuperadmin } = authResult;

    await connectToDatabase();
    const body = await request.json();
    const parsed = createBranchSchema.safeParse(body);

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

    const { name, code, status } = parsed.data;

    // Check unique code
    const existing = await Branch.findOne({ code });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Branch with code '${code}' already exists` },
        { status: 409 }
      );
    }

    const branch = await Branch.create({ name, code, status });

    await logAuditEvent({
      userId: currentSuperadmin.id,
      action: "BRANCH_CREATED",
      entity: "Branch",
      entityId: String(branch._id),
      newValue: { name, code, status },
      request,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Branch created successfully",
        data: branch,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("[branches:POST] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to create branch" },
      { status: 500 }
    );
  }
}
