import Link from "next/link";
import { Types } from "mongoose";
import "@/models";
import { connectToDatabase, getDatabaseStatus } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { LoanApplication } from "@/models/LoanApplication";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { WorkflowStatus } from "@/types";
import {
  FileText,
  Clock,
  Layers,
  CheckCircle2,
  XCircle,
  IndianRupee,
  Clock3,
  PhoneOff,
  Archive,
  PlusCircle,
  ArrowRight,
  Eye,
  Sparkles,
  TrendingUp,
  ShieldAlert,
  BarChart3,
} from "lucide-react";
import { StaggerContainer, StaggerItem } from "@/components/motion/motion-components";

export default async function HomePage() {
  const dbStatus = await getDatabaseStatus();
  const sessionUser = await getSessionUser();

  const metrics = {
    total: 0,
    loggedIn: 0,
    inProcess: 0,
    sanctioned: 0,
    disbursed: 0,
    deffered: 0,
    noResponse: 0,
    rejected: 0,
    closed: 0,
  };

  interface SafeRecentLoan {
    _id: string;
    sdmId: string;
    studentName: string;
    course: string;
    country: string;
    loanAmount: number;
    currentStage: string;
    status: WorkflowStatus;
    createdAt: string;
    branchId: { name: string; code: string };
  }

  let recentLoans: SafeRecentLoan[] = [];

  if (sessionUser && dbStatus.connected) {
    try {
      await connectToDatabase();

      let branchFilter: Record<string, unknown> = {};
      if (sessionUser.role === "BRANCH_USER" && sessionUser.branchId) {
        try {
          branchFilter = { branchId: new Types.ObjectId(sessionUser.branchId) };
        } catch {
          branchFilter = { branchId: sessionUser.branchId };
        }
      }

      const [statusStats, recent] = await Promise.all([
        LoanApplication.aggregate([
          { $match: branchFilter },
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ]),
        LoanApplication.find(branchFilter)
          .populate("branchId", "name code")
          .sort({ createdAt: -1 })
          .limit(8)
          .lean(),
      ]);

      let total = 0;
      if (Array.isArray(statusStats)) {
        for (const s of statusStats) {
          const count = Number(s.count) || 0;
          total += count;
          if (s._id === "Logged in" || s._id === "Pending") metrics.loggedIn += count;
          else if (s._id === "In Process" || s._id === "Under Review") metrics.inProcess += count;
          else if (s._id === "Sanctioned" || s._id === "Approved") metrics.sanctioned += count;
          else if (s._id === "Disbursed") metrics.disbursed += count;
          else if (s._id === "Deffered" || s._id === "On Hold") metrics.deffered += count;
          else if (s._id === "No response") metrics.noResponse += count;
          else if (s._id === "Rejected") metrics.rejected += count;
          else if (s._id === "Closed" || s._id === "Completed") metrics.closed += count;
        }
      }
      metrics.total = total;

      // Safely serialize every document to plain primitive fields to prevent RSC serialization errors
      recentLoans = (recent || []).map((loan: any) => {
        const branchObj =
          loan.branchId && typeof loan.branchId === "object"
            ? {
                name: String(loan.branchId.name || "Branch"),
                code: String(loan.branchId.code || ""),
              }
            : { name: "Branch", code: "" };

        return {
          _id: String(loan._id || ""),
          sdmId: String(loan.sdmId || ""),
          studentName: String(loan.studentName || ""),
          course: String(loan.course || ""),
          country: String(loan.country || ""),
          loanAmount: Number(loan.loanAmount) || 0,
          currentStage: String(loan.currentStage || "Inquiry"),
          status: (loan.status || "Pending") as WorkflowStatus,
          createdAt: loan.createdAt
            ? new Date(loan.createdAt).toISOString()
            : new Date().toISOString(),
          branchId: branchObj,
        };
      });
    } catch (err) {
      console.error("[HomePage] Error loading dashboard data:", err);
    }
  }

  const getStatusBadgeVariant = (st: WorkflowStatus) => {
    switch (st) {
      case "Sanctioned":
      case "Approved":
        return "success" as const;
      case "Disbursed":
        return "teal" as const;
      case "Logged in":
      case "Pending":
        return "warning" as const;
      case "In Process":
      case "Under Review":
        return "info" as const;
      case "Deffered":
      case "On Hold":
        return "purple" as const;
      case "No response":
        return "orange" as const;
      case "Rejected":
        return "destructive" as const;
      case "Closed":
      case "Completed":
        return "secondary" as const;
      default:
        return "secondary" as const;
    }
  };

  const isAdminOrSuper = sessionUser?.role === "ADMIN" || sessionUser?.role === "SUPERADMIN";
  const isSuperAdmin = sessionUser?.role === "SUPERADMIN";

  // Dashboard Cards Definition
  const statusCards = [
    {
      title: "Total Application",
      count: metrics.total,
      subtitle: "All records",
      icon: FileText,
      href: "/loans",
      colorClass: "bg-primary/10 text-primary border-primary/20",
    },
    {
      title: "Closed",
      count: metrics.closed,
      subtitle: "Completed & closed",
      icon: Archive,
      href: "/loans?status=Closed",
      colorClass: "bg-slate-500/10 text-slate-500 border-slate-500/20",
    },
    {
      title: "Deffered",
      count: metrics.deffered,
      subtitle: "Put on hold",
      icon: Clock3,
      href: "/loans?status=Deffered",
      colorClass: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    },
    {
      title: "In Process",
      count: metrics.inProcess,
      subtitle: "Under processing",
      icon: Layers,
      href: "/loans?status=In%20Process",
      colorClass: "bg-sky-500/10 text-sky-500 border-sky-500/20",
    },
    {
      title: "Logged in",
      count: metrics.loggedIn,
      subtitle: "Newly registered",
      icon: Clock,
      href: "/loans?status=Logged%20in",
      colorClass: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    },
    {
      title: "No response",
      count: metrics.noResponse,
      subtitle: "No parent response",
      icon: PhoneOff,
      href: "/loans?status=No%20response",
      colorClass: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    },
    {
      title: "Rejected",
      count: metrics.rejected,
      subtitle: "Declined or ineligible",
      icon: XCircle,
      href: "/loans?status=Rejected",
      colorClass: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    },
    {
      title: "Sanctioned",
      count: metrics.sanctioned,
      subtitle: "Sanction issued",
      icon: CheckCircle2,
      href: "/loans?status=Sanctioned",
      colorClass: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    },
    {
      title: "Disbursed",
      count: metrics.disbursed,
      subtitle: "Loan disbursed",
      icon: IndianRupee,
      href: "/loans?status=Disbursed",
      colorClass: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
    },
  ];

  return (
    <DashboardShell dbStatus={dbStatus} initialUser={sessionUser}>
      <div className="space-y-6 flex flex-col gap-6">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-primary/10 via-card/70 to-indigo-500/10 p-6 md:p-8 backdrop-blur-2xl shadow-sm">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="gap-1.5 px-3 py-1 text-xs font-semibold shadow-xs">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {sessionUser?.role === "BRANCH_USER"
                    ? "Branch Operations Workstation"
                    : sessionUser?.role === "ADMIN"
                    ? "Central Operations & Review Hub"
                    : sessionUser?.role === "VIEWER"
                    ? "Executive Auditor Console"
                    : "Executive Governance Hub"}
                </Badge>
                {sessionUser?.branchName ? (
                  <Badge variant="outline" className="text-xs backdrop-blur-sm">
                    {sessionUser.branchName}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs backdrop-blur-sm">
                    All 22 Branches
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                {sessionUser ? `Welcome back, ${sessionUser.name}` : "Loan Management Portal"}
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground max-w-2xl leading-relaxed">
                {sessionUser?.role === "BRANCH_USER"
                  ? `You are managing loan requests originating from ${sessionUser.branchName || "your branch"}. Track submissions and view admin reviews.`
                  : sessionUser?.role === "ADMIN"
                  ? "Manage workflow status, evaluate credit underwriting milestones, and update administrative remarks across all regional branches."
                  : sessionUser?.role === "VIEWER"
                  ? "Read-only executive observation portal. Review branch origination details, loan status progressions, and underwriting remarks across all 22 branches."
                  : "Centralized loan origination, student profile tracking, and multi-branch processing platform."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {sessionUser?.role === "BRANCH_USER" && (
                <Button size="sm" variant="gradient" asChild className="gap-2">
                  <Link href="/loans/new">
                    <PlusCircle className="h-4 w-4" />
                    <span>New Application</span>
                  </Link>
                </Button>
              )}
              <Button variant="default" size="sm" asChild className="gap-2 shadow-xs">
                <Link href="/loans">
                  <FileText className="h-4 w-4" />
                  <span>Application Management</span>
                </Link>
              </Button>
              {isAdminOrSuper && (
                <Button variant="gradient" size="sm" asChild className="gap-2 shadow-xs">
                  <Link href="/analytics">
                    <BarChart3 className="h-4 w-4" />
                    <span>Analytics</span>
                  </Link>
                </Button>
              )}
              {isSuperAdmin && (
                <Button variant="outline" size="sm" asChild className="gap-2">
                  <Link href="/audit-logs">
                    <ShieldAlert className="h-4 w-4" />
                    <span>Audit Logs</span>
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 9 Dashboard KPI Cards with Stagger Animation */}
        <StaggerContainer className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-9 items-stretch">
          {statusCards.map((card) => {
            const IconComponent = card.icon;
            return (
              <StaggerItem key={card.title} className="h-full">
                <Link
                  href={card.href}
                  className="group block rounded-2xl focus:outline-none h-full transition-transform"
                >
                  <Card className="glass-card card-hover h-full flex flex-col justify-between p-0 border border-border/80 shadow-xs">
                    <CardHeader className="p-3 pb-1 flex flex-row items-start justify-between space-y-0 gap-1 min-h-[38px]">
                      <span className="text-[11px] font-semibold text-muted-foreground tracking-tight group-hover:text-foreground leading-tight" title={card.title}>
                        {card.title}
                      </span>
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border transition-transform duration-200 group-hover:scale-110 ${card.colorClass}`}
                      >
                        <IconComponent className="h-3.5 w-3.5" />
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-1">
                      <div className="text-2xl font-bold text-foreground font-mono tracking-tight">
                        {card.count}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 truncate" title={card.subtitle}>
                        {card.subtitle}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              </StaggerItem>
            );
          })}
        </StaggerContainer>

        {/* Recent Applications Section */}
        <Card className="glass-card shadow-xs border border-border/80">
        <CardHeader className="p-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span>Recent Applications</span>
            </CardTitle>
            <CardDescription className="text-xs">
              {sessionUser?.role === "BRANCH_USER"
                ? `Latest submissions from ${sessionUser.branchName || "your workstation"}`
                : "Real-time stream of incoming applications across all branch operations"}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild className="gap-1 text-xs h-8">
            <Link href="/loans">
              <span>View All Records</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          {recentLoans.length === 0 ? (
            <EmptyState
              title="No recent applications"
              description={
                sessionUser?.role === "BRANCH_USER"
                  ? "No loan requests have been submitted yet for this branch. Create the first application to get started."
                  : "No loan applications registered in the system yet."
              }
              actionLabel={sessionUser?.role === "BRANCH_USER" ? "Create Application" : undefined}
              onAction={undefined}
              className="py-10 border-0"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/30 text-muted-foreground font-semibold">
                    <th className="py-3 px-4">SDM ID</th>
                    <th className="py-3 px-4">Student Name</th>
                    {sessionUser?.role !== "BRANCH_USER" && (
                      <th className="py-3 px-4">Originating Branch</th>
                    )}
                    <th className="py-3 px-4">Course & Country</th>
                    <th className="py-3 px-4 text-right">Loan Amount</th>
                    <th className="py-3 px-4">Current Stage</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {recentLoans.map((loan) => (
                    <tr
                      key={String(loan._id)}
                      className="transition-colors hover:bg-accent/40 group"
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-foreground">
                        {loan.sdmId}
                      </td>
                      <td className="py-3 px-4 font-semibold text-foreground">
                        {loan.studentName}
                      </td>
                      {sessionUser?.role !== "BRANCH_USER" && (
                        <td className="py-3 px-4">
                          <span className="font-medium text-foreground">
                            {loan.branchId?.name || "Branch"}
                          </span>
                          <span className="block text-[10px] text-muted-foreground font-mono">
                            {loan.branchId?.code || ""}
                          </span>
                        </td>
                      )}
                      <td className="py-3 px-4 text-muted-foreground">
                        <span className="text-foreground font-medium">{loan.course}</span> (
                        {loan.country})
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-foreground">
                        {formatCurrency(loan.loanAmount)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block rounded-md bg-accent/60 px-2 py-0.5 text-[11px] font-medium text-foreground">
                          {loan.currentStage}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={getStatusBadgeVariant(loan.status)}>
                          {loan.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {formatDate(loan.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm" asChild className="h-8 gap-1">
                          <Link href={`/loans/${loan._id}`}>
                            <Eye className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs">
                              {isAdminOrSuper ? "Review" : "View"}
                            </span>
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </DashboardShell>
  );
}
