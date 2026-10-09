import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { LoanApplication } from "@/models/LoanApplication";
import "@/models/Branch";
import { requireRole } from "@/lib/auth";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const STATUS_COLORS: Record<string, string> = {
  Pending: "#f59e0b",
  "Under Review": "#0ea5e9",
  "In Progress": "#6366f1",
  Approved: "#10b981",
  Rejected: "#f43f5e",
  Completed: "#8b5cf6",
  "On Hold": "#64748b",
};

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // 1. Role Guard: SUPERADMIN and ADMIN only
    const authResult = await requireRole(request, ["SUPERADMIN", "ADMIN"]);
    if ("status" in authResult) return authResult;

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "all";
    const customStart = searchParams.get("startDate");
    const customEnd = searchParams.get("endDate");

    // 2. Compute date boundaries
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (range === "30d") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      endDate = now;
    } else if (range === "90d") {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      endDate = now;
    } else if (range === "6m") {
      startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      endDate = now;
    } else if (range === "1y") {
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      endDate = now;
    } else if (range === "custom" && customStart) {
      startDate = new Date(customStart);
      endDate = customEnd ? new Date(customEnd) : now;
    }

    const matchQuery: Record<string, unknown> = {};
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) (matchQuery.createdAt as Record<string, unknown>).$gte = startDate;
      if (endDate) (matchQuery.createdAt as Record<string, unknown>).$lte = endDate;
    }

    // 3. Faceted aggregation for high performance
    const [facetResults] = await LoanApplication.aggregate([
      { $match: matchQuery },
      {
        $facet: {
          // Total metrics summary
          summary: [
            {
              $group: {
                _id: null,
                totalApplications: { $sum: 1 },
                totalRequestedAmount: { $sum: "$loanAmount" },
                avgRequestedAmount: { $avg: "$loanAmount" },
                completedCount: {
                  $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
                },
                pendingCount: {
                  $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] },
                },
                approvedCount: {
                  $sum: { $cond: [{ $eq: ["$status", "Approved"] }, 1, 0] },
                },
              },
            },
          ],

          // Monthly trend (Applications & Loan Amount)
          byMonth: [
            {
              $group: {
                _id: {
                  year: { $year: "$createdAt" },
                  month: { $month: "$createdAt" },
                },
                applications: { $sum: 1 },
                amount: { $sum: "$loanAmount" },
              },
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } },
          ],

          // Branch breakdown
          byBranch: [
            {
              $group: {
                _id: "$branchId",
                applications: { $sum: 1 },
                amount: { $sum: "$loanAmount" },
              },
            },
            {
              $lookup: {
                from: "branches",
                localField: "_id",
                foreignField: "_id",
                as: "branchInfo",
              },
            },
            { $unwind: { path: "$branchInfo", preserveNullAndEmptyArrays: true } },
            { $sort: { amount: -1 } },
          ],

          // Workflow status distribution
          byStatus: [
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
                amount: { $sum: "$loanAmount" },
              },
            },
            { $sort: { count: -1 } },
          ],

          // Intake distribution
          byIntake: [
            {
              $group: {
                _id: "$intakeMonth",
                count: { $sum: 1 },
                amount: { $sum: "$loanAmount" },
              },
            },
            { $sort: { count: -1 } },
          ],
        },
      },
    ]);

    // 4. Format Aggregated Statistics
    const rawSummary = facetResults?.summary?.[0] || {
      totalApplications: 0,
      totalRequestedAmount: 0,
      avgRequestedAmount: 0,
      completedCount: 0,
      pendingCount: 0,
      approvedCount: 0,
    };

    const totalApps = rawSummary.totalApplications || 0;
    const completedApps = rawSummary.completedCount || 0;
    const pendingApps = rawSummary.pendingCount || 0;
    const approvedApps = rawSummary.approvedCount || 0;

    // Processing rate: percentage of non-pending applications
    const processingRate =
      totalApps > 0
        ? Number((((totalApps - pendingApps) / totalApps) * 100).toFixed(1))
        : 0;

    const statistics = {
      totalApplications: totalApps,
      totalRequestedAmount: rawSummary.totalRequestedAmount || 0,
      averageRequestedAmount: Math.round(rawSummary.avgRequestedAmount || 0),
      completedApplications: completedApps,
      pendingApplications: pendingApps,
      approvedApplications: approvedApps,
      processingRate,
    };

    // 5. Format Monthly Trend Charts
    const applicationsByMonth = (facetResults?.byMonth || []).map(
      (item: { _id: { year: number; month: number }; applications: number; amount: number }) => {
        const monthName = MONTH_NAMES[(item._id.month || 1) - 1] || "Jan";
        return {
          month: `${monthName} ${item._id.year}`,
          applications: item.applications,
          amount: item.amount,
          amountInLakhs: Number((item.amount / 100000).toFixed(2)),
          amountInCrores: Number((item.amount / 10000000).toFixed(2)),
        };
      }
    );

    // 6. Format Branch Charts
    const applicationsByBranch = (facetResults?.byBranch || []).map(
      (item: {
        _id: string;
        applications: number;
        amount: number;
        branchInfo?: { name: string; code: string };
      }) => {
        const name = item.branchInfo?.name || "Unknown Branch";
        const code = item.branchInfo?.code || "BR";
        return {
          branchId: String(item._id),
          branchName: name,
          branchCode: code,
          displayName: `${code} - ${name}`,
          applications: item.applications,
          amount: item.amount,
          amountInLakhs: Number((item.amount / 100000).toFixed(2)),
          amountInCrores: Number((item.amount / 10000000).toFixed(2)),
        };
      }
    );

    // 7. Format Status Distribution
    const applicationsByStatus = (facetResults?.byStatus || []).map(
      (item: { _id: string; count: number; amount: number }) => {
        const status = item._id || "Unknown";
        const percentage =
          totalApps > 0 ? Number(((item.count / totalApps) * 100).toFixed(1)) : 0;
        return {
          status,
          count: item.count,
          amount: item.amount,
          percentage,
          color: STATUS_COLORS[status] || "#94a3b8",
        };
      }
    );

    // 8. Format Intake Distribution
    const intakeDistribution = (facetResults?.byIntake || []).map(
      (item: { _id: string; count: number; amount: number }) => {
        const intake = item._id || "Unspecified";
        const percentage =
          totalApps > 0 ? Number(((item.count / totalApps) * 100).toFixed(1)) : 0;
        return {
          intake,
          count: item.count,
          amount: item.amount,
          percentage,
        };
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        dateRange: {
          range,
          startDate: startDate ? startDate.toISOString() : null,
          endDate: endDate ? endDate.toISOString() : null,
        },
        statistics,
        charts: {
          applicationsByMonth,
          loanAmountByMonth: applicationsByMonth, // Same monthly data formatted with amount focus
          applicationsByBranch,
          loanAmountByBranch: applicationsByBranch,
          applicationsByStatus,
          intakeDistribution,
        },
      },
    });
  } catch (err: unknown) {
    console.error("[analytics:GET] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to generate system analytics" },
      { status: 500 }
    );
  }
}
