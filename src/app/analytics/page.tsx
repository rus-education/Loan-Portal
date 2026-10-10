"use client";

import * as React from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  Files,
  IndianRupee,
  CheckCircle2,
  Clock,
  Activity,
  Calendar,
  RefreshCw,
  ShieldAlert,
  ArrowUpRight,
  Filter,
  Building2,
  PieChart as PieIcon,
  Layers,
  GraduationCap,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/empty-state";
import { AnalyticsCustomTooltip } from "@/components/analytics/custom-tooltip";
import { formatCurrency, formatCompactINR } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api-client";

interface StatisticsData {
  totalApplications: number;
  totalRequestedAmount: number;
  averageRequestedAmount: number;
  completedApplications: number;
  pendingApplications: number;
  approvedApplications: number;
  processingRate: number;
}

interface MonthlyData {
  month: string;
  applications: number;
  amount: number;
  amountInLakhs: number;
  amountInCrores: number;
}

interface BranchData {
  branchId: string;
  branchName: string;
  branchCode: string;
  displayName: string;
  applications: number;
  amount: number;
  amountInLakhs: number;
  amountInCrores: number;
}

interface StatusData {
  status: string;
  count: number;
  amount: number;
  percentage: number;
  color: string;
}

interface IntakeData {
  intake: string;
  count: number;
  amount: number;
  percentage: number;
}

interface AnalyticsApiResponse {
  success: boolean;
  data?: {
    dateRange: {
      range: string;
      startDate: string | null;
      endDate: string | null;
    };
    statistics: StatisticsData;
    charts: {
      applicationsByMonth: MonthlyData[];
      loanAmountByMonth: MonthlyData[];
      applicationsByBranch: BranchData[];
      loanAmountByBranch: BranchData[];
      applicationsByStatus: StatusData[];
      intakeDistribution: IntakeData[];
    };
  };
  error?: string;
}

const PRESET_RANGES = [
  { id: "30d", label: "Last 30 Days" },
  { id: "90d", label: "Last 90 Days" },
  { id: "6m", label: "Last 6 Months" },
  { id: "1y", label: "This Year" },
  { id: "all", label: "All Time" },
  { id: "custom", label: "Custom Range" },
];

export default function AnalyticsPage() {
  const { user: currentUser, isLoading: isAuthLoading } = useAuth();
  const isMounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Filter states
  const [selectedRange, setSelectedRange] = React.useState("all");
  const [customStartDate, setCustomStartDate] = React.useState("");
  const [customEndDate, setCustomEndDate] = React.useState("");
  const [reloadTrigger, setReloadTrigger] = React.useState(0);

  // Data states
  const [analyticsData, setAnalyticsData] = React.useState<AnalyticsApiResponse["data"] | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch analytics data
  React.useEffect(() => {
    if (isAuthLoading) return;
    if (!currentUser || (currentUser.role !== "SUPERADMIN" && currentUser.role !== "ADMIN")) {
      setIsLoading(false);
      return;
    }

    let ignore = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("range", selectedRange);

        if (selectedRange === "custom") {
          if (customStartDate) params.set("startDate", customStartDate);
          if (customEndDate) params.set("endDate", customEndDate);
        }

        const res = await apiFetch(`/api/analytics?${params.toString()}`);
        const data: AnalyticsApiResponse = await res.json();

        if (!ignore) {
          if (!res.ok || !data.success || !data.data) {
            setError(data.error || "Failed to load executive analytics.");
          } else {
            setAnalyticsData(data.data);
          }
        }
      } catch (err) {
        if (!ignore) {
          console.error("Error fetching analytics:", err);
          setError("Network error occurred while fetching analytics.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [currentUser, isAuthLoading, selectedRange, customStartDate, customEndDate, reloadTrigger]);

  const handleApplyCustomFilter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStartDate) {
      setError("Please select a valid start date for the custom range.");
      return;
    }
    setReloadTrigger((v) => v + 1);
  };

  // Unauthorized view for non-admins (BRANCH_USER, VIEWER)
  if (!isAuthLoading && currentUser && currentUser.role !== "SUPERADMIN" && currentUser.role !== "ADMIN") {
    return (
      <DashboardShell initialUser={currentUser}>
        <div className="flex min-h-[65vh] items-center justify-center p-4">
          <Card className="glass-card max-w-md w-full text-center border-amber-500/20 p-6 md:p-8 shadow-xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 mb-4 ring-8 ring-amber-500/5">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <CardTitle className="text-xl font-bold text-foreground">
              Executive Analytics Restricted
            </CardTitle>
            <CardDescription className="text-xs md:text-sm text-muted-foreground mt-2 leading-relaxed">
              Consolidated portfolio statistics, financial loan volume distributions, and cross-branch velocity analytics are strictly restricted to <strong>Superadmin</strong> and <strong>Admin</strong> underwriters.
            </CardDescription>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="default" asChild className="gap-2">
                <Link href="/loans">
                  <Files className="h-4 w-4" />
                  <span>Go to Applications</span>
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">Overview Hub</Link>
              </Button>
            </div>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const stats = analyticsData?.statistics;
  const charts = analyticsData?.charts;
  const hasApplications = (stats?.totalApplications || 0) > 0;

  return (
    <DashboardShell initialUser={currentUser}>
      <div className="space-y-6 pb-12">
        {/* Header & Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-indigo-600 text-white shadow-md shadow-primary/20">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                Portfolio Analytics & BI
              </h1>
              <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20 font-semibold">
                SuperAdmin / Admin
              </Badge>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground mt-1 max-w-2xl">
              Consolidated loan origination performance, underwriting processing velocity, branch distributions, and seasonal intake targets.
            </p>
          </div>

          {/* Date Range Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl border border-border/80 bg-card/60 p-1 backdrop-blur-md shadow-xs">
              {PRESET_RANGES.map((r) => {
                const isActive = selectedRange === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelectedRange(r.id);
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setReloadTrigger((v) => v + 1)}
              disabled={isLoading}
              className="gap-2 shadow-xs"
              title="Refresh Analytics"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-primary" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        {/* Custom Range Picker Drawer */}
        {selectedRange === "custom" && (
          <form
            onSubmit={handleApplyCustomFilter}
            className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/80 bg-card/70 p-4 shadow-sm backdrop-blur-md"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground mr-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span>Select Date Window:</span>
            </div>
            <div className="space-y-1">
              <label htmlFor="startDateInput" className="text-[11px] font-medium text-muted-foreground">Start Date</label>
              <Input
                id="startDateInput"
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-8 text-xs w-36"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="endDateInput" className="text-[11px] font-medium text-muted-foreground">End Date</label>
              <Input
                id="endDateInput"
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-8 text-xs w-36"
              />
            </div>
            <Button type="submit" size="sm" variant="gradient" disabled={isLoading} className="gap-1.5 h-8 text-xs">
              <Filter className="h-3.5 w-3.5" />
              <span>Apply Window</span>
            </Button>
          </form>
        )}

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 6 KEY STATISTICS KPI CARDS */}
        <div className="grid gap-3.5 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {/* 1. Total Applications */}
          <Card className="glass-card card-hover relative overflow-hidden">
            <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Total Applications
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Files className="h-3.5 w-3.5" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {isLoading ? (
                <Skeleton className="h-7 w-20 my-1" />
              ) : (
                <div className="text-2xl font-bold text-foreground font-mono">
                  {stats?.totalApplications.toLocaleString("en-IN") || 0}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-0.5">Originated in selected window</p>
            </CardContent>
          </Card>

          {/* 2. Total Requested Loan Amount */}
          <Card className="glass-card card-hover relative overflow-hidden">
            <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Total Requested
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                <IndianRupee className="h-3.5 w-3.5" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {isLoading ? (
                <Skeleton className="h-7 w-24 my-1" />
              ) : (
                <div
                  className="text-2xl font-bold text-foreground font-mono truncate"
                  title={formatCurrency(stats?.totalRequestedAmount || 0)}
                >
                  {formatCompactINR(stats?.totalRequestedAmount || 0)}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate" title={formatCurrency(stats?.totalRequestedAmount || 0)}>
                {stats?.totalRequestedAmount ? formatCurrency(stats.totalRequestedAmount) : "₹0"}
              </p>
            </CardContent>
          </Card>

          {/* 3. Average Requested Amount */}
          <Card className="glass-card card-hover relative overflow-hidden">
            <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Average Sanction
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {isLoading ? (
                <Skeleton className="h-7 w-20 my-1" />
              ) : (
                <div className="text-2xl font-bold text-foreground font-mono truncate">
                  {formatCompactINR(stats?.averageRequestedAmount || 0)}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-0.5">Average ticket per candidate</p>
            </CardContent>
          </Card>

          {/* 4. Completed Applications */}
          <Card className="glass-card card-hover relative overflow-hidden">
            <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Completed
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {isLoading ? (
                <Skeleton className="h-7 w-16 my-1" />
              ) : (
                <div className="text-2xl font-bold text-foreground font-mono">
                  {stats?.completedApplications.toLocaleString("en-IN") || 0}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-0.5">Disbursed & archived loans</p>
            </CardContent>
          </Card>

          {/* 5. Pending Applications */}
          <Card className="glass-card card-hover relative overflow-hidden">
            <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Pending Review
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <Clock className="h-3.5 w-3.5" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {isLoading ? (
                <Skeleton className="h-7 w-16 my-1" />
              ) : (
                <div className="text-2xl font-bold text-foreground font-mono">
                  {stats?.pendingApplications.toLocaleString("en-IN") || 0}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-0.5">Awaiting initial underwriting</p>
            </CardContent>
          </Card>

          {/* 6. Processing Rate */}
          <Card className="glass-card card-hover relative overflow-hidden">
            <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between space-y-0">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Processing Velocity
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500">
                <Activity className="h-3.5 w-3.5" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {isLoading ? (
                <Skeleton className="h-7 w-16 my-1" />
              ) : (
                <div className="text-2xl font-bold text-foreground font-mono">
                  {stats?.processingRate || 0}%
                </div>
              )}
              <div className="mt-2 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-indigo-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, stats?.processingRate || 0))}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 6 RECHARTS CHARTS SECTION */}
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="glass-card p-6">
                <Skeleton className="h-6 w-48 mb-4" />
                <Skeleton className="h-[280px] w-full rounded-xl" />
              </Card>
            ))}
          </div>
        ) : !hasApplications ? (
          <EmptyState
            icon={<BarChart3 className="h-7 w-7 stroke-[1.5]" />}
            title="No Applications Recorded For Selected Window"
            description="There are no loan requests originating in this date range. Try switching to 'All Time' or select an earlier date boundary."
            actionLabel="Reset to All Time"
            onAction={() => setSelectedRange("all")}
          />
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {/* 1. Applications by Month */}
            <Card className="glass-card overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span>Applications by Month</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Monthly loan request origination trends
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    Trend
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-6">
                <div className="h-[280px] w-full min-w-0">
                  {isMounted && (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={charts?.applicationsByMonth || []}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="appsGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                        <XAxis
                          dataKey="month"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip
                          content={<AnalyticsCustomTooltip valueLabel="Applications" formatterType="count" />}
                        />
                        <Area
                          type="monotone"
                          dataKey="applications"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2.5}
                          fill="url(#appsGrad)"
                          dot={{ r: 4, fill: "hsl(var(--primary))" }}
                          activeDot={{ r: 6, stroke: "hsl(var(--background))", strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 2. Loan Amount by Month */}
            <Card className="glass-card overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <IndianRupee className="h-4 w-4 text-emerald-500" />
                      <span>Loan Amount by Month</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Monthly loan request capital volume in Lakhs (₹)
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono text-emerald-500 border-emerald-500/20">
                    Volume
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-6">
                <div className="h-[280px] w-full min-w-0">
                  {isMounted && (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={charts?.loanAmountByMonth || []}
                        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="amountGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                        <XAxis
                          dataKey="month"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(val) => `₹${val}L`}
                        />
                        <Tooltip
                          content={<AnalyticsCustomTooltip valueLabel="Volume (Lakhs)" formatterType="amountInLakhs" />}
                        />
                        <Area
                          type="monotone"
                          dataKey="amountInLakhs"
                          stroke="#10b981"
                          strokeWidth={2.5}
                          fill="url(#amountGrad)"
                          dot={{ r: 4, fill: "#10b981" }}
                          activeDot={{ r: 6, stroke: "hsl(var(--background))", strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 3. Applications by Branch */}
            <Card className="glass-card overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-indigo-500" />
                      <span>Applications by Branch</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Origination count per regional office
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    Regional
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-6">
                <div className="h-[280px] w-full min-w-0">
                  {isMounted && (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={(charts?.applicationsByBranch || []).slice(0, 10)}
                        margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                        <XAxis
                          dataKey="branchCode"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          angle={-20}
                          textAnchor="end"
                        />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip
                          content={<AnalyticsCustomTooltip valueLabel="Applications" formatterType="count" />}
                        />
                        <Bar
                          dataKey="applications"
                          fill="hsl(var(--primary))"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 4. Loan Amount by Branch */}
            <Card className="glass-card overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <IndianRupee className="h-4 w-4 text-sky-500" />
                      <span>Loan Amount by Branch</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Loan portfolio amount in Lakhs (₹) by regional center
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono text-sky-500 border-sky-500/20">
                    Disbursement
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-6">
                <div className="h-[280px] w-full min-w-0">
                  {isMounted && (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={(charts?.loanAmountByBranch || []).slice(0, 10)}
                        margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                        <XAxis
                          dataKey="branchCode"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          angle={-20}
                          textAnchor="end"
                        />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(val) => `₹${val}L`}
                        />
                        <Tooltip
                          content={<AnalyticsCustomTooltip valueLabel="Loan Amount (Lakhs)" formatterType="amountInLakhs" />}
                        />
                        <Bar
                          dataKey="amountInLakhs"
                          fill="#6366f1"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 5. Applications by Status */}
            <Card className="glass-card overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <PieIcon className="h-4 w-4 text-amber-500" />
                      <span>Applications by Status</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Current workflow stage distribution
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    Lifecycle
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="h-[240px] w-full sm:w-1/2 min-w-0">
                    {isMounted && (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={charts?.applicationsByStatus || []}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={3}
                            dataKey="count"
                            nameKey="status"
                          >
                            {(charts?.applicationsByStatus || []).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                            ))}
                          </Pie>
                          <Tooltip
                            content={<AnalyticsCustomTooltip valueLabel="Applications" formatterType="count" />}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Status Legend */}
                  <div className="w-full sm:w-1/2 space-y-2 text-xs">
                    {(charts?.applicationsByStatus || []).map((s) => (
                      <div key={s.status} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: s.color }}
                          />
                          <span className="text-muted-foreground truncate">{s.status}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono tabular-nums shrink-0">
                          <span className="font-semibold text-foreground">{s.count}</span>
                          <span className="text-[11px] text-muted-foreground">({s.percentage}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 6. Intake Distribution */}
            <Card className="glass-card overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-purple-500" />
                      <span>Intake Distribution</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Academic intake season targets & volume
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono text-purple-500 border-purple-500/20">
                    Academic
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-6">
                <div className="h-[280px] w-full min-w-0">
                  {isMounted && (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={charts?.intakeDistribution || []}
                        margin={{ top: 10, right: 10, left: -20, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                        <XAxis
                          dataKey="intake"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip
                          content={<AnalyticsCustomTooltip valueLabel="Candidates" formatterType="count" />}
                        />
                        <Bar
                          dataKey="count"
                          fill="#8b5cf6"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick Link Navigation */}
        <div className="flex items-center justify-between rounded-2xl border border-border/80 bg-card/60 p-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Need line-item loan records?</p>
              <p className="text-[11px] text-muted-foreground">Jump directly to application underwriting records with detailed search filters.</p>
            </div>
          </div>
          <Button size="sm" variant="outline" asChild className="gap-1.5 text-xs shadow-xs">
            <Link href="/loans">
              <span>View Loans</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </DashboardShell>
  );
}
