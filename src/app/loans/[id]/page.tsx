"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  GraduationCap,
  IndianRupee,
  Calendar,
  Building2,
  Layers,
  MessageSquare,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Save,
  Loader2,
  ArrowRight,
  AlertCircle,
  FileCheck2,
  History,
  Lock,
  Sparkles,
  Eye,
  Trash2,
  Edit2,
  X,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toaster";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import type { UserSession, WorkflowStatus, StatusHistoryItem } from "@/types";

interface LoanDetail {
  _id: string;
  sdmId: string;
  studentName: string;
  contactNumber: string;
  branchId: {
    _id: string;
    name: string;
    code: string;
    status: string;
  };
  course: string;
  country: string;
  loanAmount: number;
  intakeMonth: string;
  intakeYear: number;
  parentGuardianIncomeSource: string;
  currentStage: string;
  status: WorkflowStatus;
  statusHistory?: StatusHistoryItem[];
  branchRemarks: string;
  adminRemarks: string;
  createdBy: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  updatedBy?: {
    _id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

const WORKFLOW_STAGES = [
  "Initial Inquiry",
  "Document Collection",
  "Credit Evaluation",
  "Bank Submission",
  "Underwriting Review",
  "Sanction Letter Issued",
  "Disbursement in Progress",
  "Loan Disbursed",
  "Closed",
];

const WORKFLOW_STATUSES: WorkflowStatus[] = [
  "Pending",
  "Under Review",
  "In Progress",
  "Approved",
  "Rejected",
  "Completed",
  "On Hold",
];

// Linear pipeline sequence for the visual stepper bar
const PIPELINE_STEPS: WorkflowStatus[] = [
  "Pending",
  "Under Review",
  "In Progress",
  "Approved",
  "Completed",
];

export default function LoanDetailPage() {
  const params = useParams();
  const loanId = params.id as string;

  const [currentUser, setCurrentUser] = React.useState<UserSession | null>(null);
  const [loan, setLoan] = React.useState<LoanDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Admin managed state
  const [adminStatus, setAdminStatus] = React.useState<WorkflowStatus>("Pending");
  const [adminStage, setAdminStage] = React.useState<string>("Initial Inquiry");
  const router = useRouter();
  const [adminRemarks, setAdminRemarks] = React.useState<string>("");
  const [transitionNote, setTransitionNote] = React.useState<string>("");
  const [isAdminSaving, setIsAdminSaving] = React.useState(false);
  const [adminSaveSuccess, setAdminSaveSuccess] = React.useState<string | null>(null);
  const [adminSaveError, setAdminSaveError] = React.useState<string | null>(null);

  // Branch user remarks state
  const [branchRemarks, setBranchRemarks] = React.useState("");
  const [isSavingBranchRemarks, setIsSavingBranchRemarks] = React.useState(false);
  const [branchSaveSuccess, setBranchSaveSuccess] = React.useState<string | null>(null);

  // SuperAdmin Data Correction Modal state
  const [isCorrectionOpen, setIsCorrectionOpen] = React.useState(false);
  const [corrStudentName, setCorrStudentName] = React.useState("");
  const [corrContactNumber, setCorrContactNumber] = React.useState("");
  const [corrCourse, setCorrCourse] = React.useState("");
  const [corrCountry, setCorrCountry] = React.useState("");
  const [corrLoanAmount, setCorrLoanAmount] = React.useState<number>(0);
  const [corrIntakeMonth, setCorrIntakeMonth] = React.useState("");
  const [corrIntakeYear, setCorrIntakeYear] = React.useState<number>(2025);
  const [corrIncomeSource, setCorrIncomeSource] = React.useState("");
  const [corrBranchRemarks, setCorrBranchRemarks] = React.useState("");
  const [isSavingCorrection, setIsSavingCorrection] = React.useState(false);
  const [correctionError, setCorrectionError] = React.useState<string | null>(null);

  // SuperAdmin Delete Application Modal state
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const [reloadTrigger, setReloadTrigger] = React.useState(0);

  // 1. Fetch current user session
  React.useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.success && data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch((err) => console.error("Session error:", err));
  }, []);

  // 2. Fetch loan detail
  React.useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch(`/api/loans/${loanId}`);
        const data = await res.json();

        if (ignore) return;
        if (!res.ok || !data.success) {
          setErrorMessage(data.error || "Failed to load loan record");
          return;
        }

        const l: LoanDetail = data.data;
        setLoan(l);
        setBranchRemarks(l.branchRemarks || "");
        setAdminStatus(l.status);
        setAdminStage(l.currentStage || "Initial Inquiry");
        setAdminRemarks(l.adminRemarks || "");

        // Sync correction form
        setCorrStudentName(l.studentName || "");
        setCorrContactNumber(l.contactNumber || "");
        setCorrCourse(l.course || "");
        setCorrCountry(l.country || "");
        setCorrLoanAmount(l.loanAmount || 0);
        setCorrIntakeMonth(l.intakeMonth || "");
        setCorrIntakeYear(l.intakeYear || 2025);
        setCorrIncomeSource(l.parentGuardianIncomeSource || "");
        setCorrBranchRemarks(l.branchRemarks || "");
      } catch {
        if (!ignore) {
          setErrorMessage("Network error occurred while fetching loan details");
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
  }, [loanId, reloadTrigger]);

  const isAdminOrSuper = currentUser?.role === "ADMIN" || currentUser?.role === "SUPERADMIN";
  const isBranchUser = currentUser?.role === "BRANCH_USER";

  // Check if admin form has uncommitted changes
  const hasAdminChanges =
    loan &&
    (adminStatus !== loan.status ||
      adminStage !== loan.currentStage ||
      adminRemarks !== (loan.adminRemarks || "") ||
      transitionNote.trim().length > 0);

  // Handle Admin update: Status, Admin Remarks, Current Stage
  const handleSaveAdminDecision = async () => {
    if (!loan) return;
    setIsAdminSaving(true);
    setAdminSaveSuccess(null);
    setAdminSaveError(null);

    try {
      const payload: Record<string, unknown> = {
        status: adminStatus,
        currentStage: adminStage,
        adminRemarks: adminRemarks,
      };

      if (transitionNote.trim()) {
        payload.statusRemarks = transitionNote.trim();
      }

      const res = await fetch(`/api/loans/${loanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setAdminSaveError(data.error || "Failed to apply administrative update");
        return;
      }

      setLoan(data.data);
      setAdminStatus(data.data.status);
      setAdminStage(data.data.currentStage);
      setAdminRemarks(data.data.adminRemarks || "");
      setTransitionNote("");
      setAdminSaveSuccess("Administrative decision and workflow status updated successfully.");
      toast.success(`Workflow status updated to '${adminStatus}'`);
      setTimeout(() => setAdminSaveSuccess(null), 5000);
    } catch {
      setAdminSaveError("Network error occurred while updating loan status");
      toast.error("Failed to update status");
    } finally {
      setIsAdminSaving(false);
    }
  };

  // Handle Branch Counselor update
  const handleSaveBranchRemarks = async () => {
    if (!loan) return;
    setIsSavingBranchRemarks(true);
    setBranchSaveSuccess(null);

    try {
      const res = await fetch(`/api/loans/${loanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchRemarks }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.error || "Failed to update branch remarks");
        return;
      }

      setLoan(data.data);
      setBranchSaveSuccess("Branch counselor observations saved successfully.");
      toast.success("Branch counselor remarks saved successfully");
      setTimeout(() => setBranchSaveSuccess(null), 4000);
    } catch {
      alert("Network error occurred while saving branch remarks");
      toast.error("Failed to save branch remarks");
    } finally {
      setIsSavingBranchRemarks(false);
    }
  };

  // Handle SuperAdmin Data Correction
  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loan) return;
    setIsSavingCorrection(true);
    setCorrectionError(null);

    try {
      const res = await fetch(`/api/loans/${loanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: corrStudentName.trim(),
          contactNumber: corrContactNumber.trim(),
          course: corrCourse.trim(),
          country: corrCountry.trim(),
          loanAmount: Number(corrLoanAmount),
          intakeMonth: corrIntakeMonth,
          intakeYear: Number(corrIntakeYear),
          parentGuardianIncomeSource: corrIncomeSource.trim(),
          branchRemarks: corrBranchRemarks.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setCorrectionError(data.error || "Failed to apply data corrections");
        return;
      }

      setLoan(data.data);
      setIsCorrectionOpen(false);
      setAdminSaveSuccess("SuperAdmin data correction applied successfully.");
      toast.success("SuperAdmin data correction applied successfully");
      setTimeout(() => setAdminSaveSuccess(null), 5000);
      setReloadTrigger((r) => r + 1);
    } catch {
      setCorrectionError("Network error occurred while applying corrections");
      toast.error("Failed to apply data corrections");
    } finally {
      setIsSavingCorrection(false);
    }
  };

  // Handle SuperAdmin Delete Application
  const handleDeleteLoan = async () => {
    if (!loan) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/loans/${loanId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsDeleteConfirmOpen(false);
        toast.success("Loan application permanently deleted");
        router.push("/loans");
      } else {
        alert(data.error || "Failed to delete loan application");
        toast.error(data.error || "Failed to delete loan application");
        setIsDeleting(false);
      }
    } catch {
      alert("Network error occurred while deleting application");
      setIsDeleting(false);
    }
  };

  const getStatusBadgeVariant = (st: WorkflowStatus | string) => {
    switch (st) {
      case "Approved":
        return "success" as const;
      case "Pending":
        return "warning" as const;
      case "In Progress":
      case "Under Review":
        return "info" as const;
      case "Rejected":
        return "destructive" as const;
      case "Completed":
        return "purple" as const;
      default:
        return "secondary" as const;
    }
  };

  if (isLoading) {
    return (
      <DashboardShell initialUser={currentUser}>
        <div className="flex min-h-[50vh] items-center justify-center">
          <LoadingState
            message="Loading loan application dossier..."
            description="Retrieving branch-submitted parameters and administrative audit history."
          />
        </div>
      </DashboardShell>
    );
  }

  if (errorMessage || !loan) {
    return (
      <DashboardShell initialUser={currentUser}>
        <div className="flex min-h-[60vh] items-center justify-center">
          <ErrorState
            title="Unable to Access Loan Record"
            description={errorMessage || "The requested loan application could not be retrieved."}
            onRetry={() => {
              setIsLoading(true);
              setReloadTrigger((r) => r + 1);
            }}
          />
        </div>
      </DashboardShell>
    );
  }

  // Calculate pipeline progression index
  const currentPipelineIndex = PIPELINE_STEPS.indexOf(loan.status);

  return (
    <DashboardShell initialUser={currentUser}>
      <div className="space-y-6">
        {/* Top Header / Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" asChild className="h-9 w-9">
              <Link href="/loans" aria-label="Back to application management">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  {loan.studentName}
                </h1>
                <Badge variant={getStatusBadgeVariant(loan.status)} className="px-2.5 py-0.5 font-semibold">
                  {loan.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
                <span className="font-mono font-bold text-primary">{loan.sdmId}</span>
                <span>•</span>
                <span>
                  {loan.branchId?.name} ({loan.branchId?.code})
                </span>
                <span>•</span>
                <span>Submitted {formatDate(loan.createdAt)}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild className="h-9">
              <Link href="/loans">Back to Directory</Link>
            </Button>

            {currentUser?.role === "SUPERADMIN" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCorrectionOpen(true)}
                  className="gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10 h-9"
                  title="Correct student or branch entered data"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Correct Data</span>
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  className="gap-1.5 text-xs h-9"
                  title="Permanently delete loan application"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete File</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Auditor Read-Only Notification Banner */}
        {currentUser?.role === "VIEWER" && (
          <div className="flex items-center gap-2.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-xs text-sky-700 dark:text-sky-300">
            <Eye className="h-4 w-4 shrink-0 text-sky-500" />
            <div className="flex-1">
              <span className="font-semibold">Auditor Read-Only Mode:</span>{" "}
              You have full cross-branch visibility into student profile, financial parameters, administrative remarks, and status timeline. All modification controls are disabled.
            </div>
            <Badge variant="outline" className="border-sky-500/40 text-[10px] text-sky-600 dark:text-sky-300 shrink-0">
              Read-Only
            </Badge>
          </div>
        )}

        {/* Visual Workflow Progress Stepper (Pending -> Under Review -> In Progress -> Approved -> Completed) */}
        <Card className="glass-card overflow-hidden">
          <CardHeader className="p-3.5 pb-2 border-b border-border/50 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <FileCheck2 className="h-3.5 w-3.5 text-primary" />
              <span>Standard Workflow Pipeline Progression</span>
            </CardTitle>
            <span className="text-[11px] font-mono font-medium text-foreground">
              Current Status: <strong className="text-primary">{loan.status}</strong>
            </span>
          </CardHeader>
          <CardContent className="p-4 pt-3">
            <div className="grid grid-cols-5 gap-2 relative">
              {PIPELINE_STEPS.map((step, idx) => {
                const isPassed =
                  currentPipelineIndex !== -1 && idx <= currentPipelineIndex;
                const isCurrent = step === loan.status;

                return (
                  <div
                    key={step}
                    className={`relative flex flex-col items-center p-2 rounded-xl text-center transition-all ${
                      isCurrent
                        ? "bg-primary/10 border border-primary/40 shadow-xs ring-1 ring-primary/30"
                        : isPassed
                        ? "bg-muted/40 border border-border/60 text-muted-foreground"
                        : "bg-muted/10 border border-border/30 opacity-60 text-muted-foreground"
                    }`}
                  >
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold mb-1 ${
                        isCurrent
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : isPassed
                          ? "bg-emerald-500 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isPassed && !isCurrent ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span
                      className={`text-[11px] font-medium leading-tight ${
                        isCurrent
                          ? "font-bold text-foreground"
                          : isPassed
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 4 Summary Metric Indicators */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="glass-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Processing Milestone
                </p>
                <p className="text-sm font-bold text-foreground mt-1">{loan.currentStage}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Layers className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Sanction Requested
                </p>
                <p className="text-sm font-bold text-foreground mt-1 font-mono">
                  {formatCurrency(loan.loanAmount)}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <IndianRupee className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Target Intake
                </p>
                <p className="text-sm font-bold text-foreground mt-1">
                  {loan.intakeMonth} {loan.intakeYear}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                <Calendar className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Originating Branch
                </p>
                <p className="text-sm font-bold text-foreground mt-1 truncate max-w-[140px]">
                  {loan.branchId?.name}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <Building2 className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ========================================================================= */}
        {/* SECTION A: BRANCH ORIGINATION DOSSIER (Branch-Submitted Information)      */}
        {/* Keep branch-submitted data visually separated from admin-managed data    */}
        {/* ========================================================================= */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border/70 pb-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-amber-500" />
              <h2 className="text-base font-semibold text-foreground">
                Branch Origination Dossier
              </h2>
              <Badge variant="outline" className="text-[10px] font-semibold">
                Branch-Submitted Data
              </Badge>
            </div>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3 text-muted-foreground/70" />
              {isAdminOrSuper
                ? "Locked branch record (Protected from Admin overwrite)"
                : "Your branch submission record"}
            </span>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* 1. Student Personal & Co-Applicant Particulars */}
            <Card className="glass-card border-border/80">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <User className="h-4 w-4 text-primary" />
                  Student Identity & Co-Applicant
                </CardTitle>
                <CardDescription className="text-xs">
                  Applicant contact and financial sponsor credentials
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Full Name:</span>
                  <span className="font-semibold text-foreground">{loan.studentName}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Contact Phone:</span>
                  <span className="font-mono font-medium text-foreground">{loan.contactNumber}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">SDM Identification:</span>
                  <span className="font-mono font-bold text-primary">{loan.sdmId}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Originating Branch:</span>
                  <span className="font-medium text-foreground">
                    {loan.branchId?.name} ({loan.branchId?.code})
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Parent/Guardian Income Source:</span>
                  <span className="font-semibold text-foreground">
                    {loan.parentGuardianIncomeSource}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Originated By Officer:</span>
                  <span className="text-foreground">
                    {loan.createdBy?.name || "Branch Counselor"} (
                    {loan.createdBy?.email || "Branch Desk"})
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 2. Educational & Loan Parameters */}
            <Card className="glass-card border-border/80">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  Academic Program & Loan Request
                </CardTitle>
                <CardDescription className="text-xs">
                  Course details, destination territory, and sanction requirement
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Course / Degree:</span>
                  <span className="font-semibold text-foreground">{loan.course}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Destination Country:</span>
                  <span className="font-semibold text-foreground">{loan.country}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Sanction Requested:</span>
                  <span className="font-mono font-bold text-foreground">
                    {formatCurrency(loan.loanAmount)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Target Intake:</span>
                  <span className="text-foreground font-medium">
                    {loan.intakeMonth} {loan.intakeYear}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Created At:</span>
                  <span className="text-muted-foreground">{formatDateTime(loan.createdAt)}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Last System Update:</span>
                  <span className="text-muted-foreground">{formatDateTime(loan.updatedAt)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Branch Counselor Remarks Card */}
          <Card className="glass-card border-border/80">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <MessageSquare className="h-4 w-4 text-indigo-500" />
                  <span>Branch Counselor Remarks & Initial Observations</span>
                </CardTitle>
                {isBranchUser ? (
                  <Badge variant="info" className="text-[10px]">
                    Editable by Counselor
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    Read-Only Branch Remarks
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                Counselor notes recorded during initial in-person student interview at branch
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {isBranchUser ? (
                <>
                  <Textarea
                    value={branchRemarks}
                    onChange={(e) => setBranchRemarks(e.target.value)}
                    rows={3}
                    placeholder="Enter counselor observations regarding student profile, financial credibility, or parent background..."
                    disabled={isSavingBranchRemarks}
                    className="text-xs"
                  />
                  {branchSaveSuccess && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{branchSaveSuccess}</span>
                    </p>
                  )}
                  <div className="flex justify-end">
                    <Button
                      onClick={handleSaveBranchRemarks}
                      size="sm"
                      disabled={isSavingBranchRemarks || branchRemarks === (loan.branchRemarks || "")}
                      className="gap-1.5 text-xs h-8"
                    >
                      {isSavingBranchRemarks ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-3.5 w-3.5" />
                          <span>Save Counselor Remarks</span>
                        </>
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-xs text-foreground leading-relaxed">
                  {loan.branchRemarks ? (
                    <p className="whitespace-pre-wrap">{loan.branchRemarks}</p>
                  ) : (
                    <p className="italic text-muted-foreground">
                      No counselor remarks were recorded during branch entry.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ========================================================================= */}
        {/* SECTION B: CENTRAL ADMINISTRATIVE ADJUDICATION (Admin Managed Data)       */}
        {/* Admin can change workflow status, update remarks, update processing stage */}
        {/* ========================================================================= */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-border/70 pb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold text-foreground">
                Central Administrative Adjudication & Processing
              </h2>
              <Badge variant="default" className="text-[10px] gap-1 font-semibold">
                <Sparkles className="h-3 w-3" />
                Admin-Managed Controls
              </Badge>
            </div>
            {isAdminOrSuper && (
              <span className="text-[11px] text-primary font-medium">
                Authorized Admin Adjudication Console
              </span>
            )}
          </div>

          {isAdminOrSuper ? (
            /* ADMIN / SUPERADMIN Interactive Control Console */
            <Card className="glass-card border-2 border-primary/30 shadow-md">
              <CardHeader className="p-4 pb-3 border-b border-border/60 bg-primary/5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <span>Underwriting & Workflow Adjudication Panel</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Update workflow status, assign current processing stage milestone, and record official admin remarks
                    </CardDescription>
                  </div>
                  <Badge variant={getStatusBadgeVariant(adminStatus)} className="self-start sm:self-auto px-2.5 py-1 text-xs">
                    Current: {adminStatus}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-4">
                {/* Status and Stage Dropdowns */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Workflow Status Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>Change Workflow Status</span>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        Select new operational state
                      </span>
                    </label>
                    <Select
                      value={adminStatus}
                      onChange={(e) => setAdminStatus(e.target.value as WorkflowStatus)}
                      className="h-9 text-xs font-medium"
                    >
                      {WORKFLOW_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {/* Processing Stage Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>Update Processing Stage</span>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        Underwriting milestone
                      </span>
                    </label>
                    <Select
                      value={adminStage}
                      onChange={(e) => setAdminStage(e.target.value)}
                      className="h-9 text-xs font-medium"
                    >
                      {WORKFLOW_STAGES.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                {/* Admin Remarks Editor */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Central Admin Remarks</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      Visible to branch users and system auditors
                    </span>
                  </label>
                  <Textarea
                    value={adminRemarks}
                    onChange={(e) => setAdminRemarks(e.target.value)}
                    rows={4}
                    placeholder="Enter comprehensive administrative assessment, underwriting requirements, sanction conditions, or reason for rejection/hold..."
                    className="text-xs"
                  />
                </div>

                {/* Optional Status Transition Note */}
                {adminStatus !== loan.status && (
                  <div className="space-y-1.5 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
                    <label className="text-xs font-semibold text-primary flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Status Transition Note (Recorded in Status History Timeline)</span>
                    </label>
                    <Input
                      value={transitionNote}
                      onChange={(e) => setTransitionNote(e.target.value)}
                      placeholder={`E.g., Transitioned from ${loan.status} to ${adminStatus} following bank credit clearance.`}
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                )}

                {/* Feedback Alerts */}
                {adminSaveSuccess && (
                  <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{adminSaveSuccess}</span>
                  </div>
                )}

                {adminSaveError && (
                  <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{adminSaveError}</span>
                  </div>
                )}

                {/* Save Decision Button */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-border/50">
                  <span className="text-[11px] text-muted-foreground">
                    {hasAdminChanges
                      ? "Unsaved administrative changes pending"
                      : "Administrative review synchronized"}
                  </span>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {hasAdminChanges && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setAdminStatus(loan.status);
                          setAdminStage(loan.currentStage);
                          setAdminRemarks(loan.adminRemarks || "");
                          setTransitionNote("");
                        }}
                        disabled={isAdminSaving}
                        className="text-xs h-9 px-3"
                      >
                        Discard
                      </Button>
                    )}

                    <Button
                      onClick={handleSaveAdminDecision}
                      disabled={isAdminSaving || !hasAdminChanges}
                      className="gap-2 text-xs h-9 px-4 w-full sm:w-auto shadow-sm"
                    >
                      {isAdminSaving ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-3.5 w-3.5" />
                          <span>Save Administrative Decision</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* BRANCH USER / VIEWER Read-Only Showcase of Admin Data */
            <Card className="glass-card border-l-4 border-l-primary">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span>Central Administrative Adjudication</span>
                  </CardTitle>
                  <div className="flex items-center gap-1.5">
                    {currentUser?.role === "VIEWER" && (
                      <Badge variant="outline" className="border-sky-500/40 text-[10px] text-sky-600 dark:text-sky-300">
                        Auditor Observation
                      </Badge>
                    )}
                    <Badge variant={getStatusBadgeVariant(loan.status)} className="text-xs">
                      {loan.status}
                    </Badge>
                  </div>
                </div>
                <CardDescription className="text-xs">
                  Official evaluation by the national credit review administration
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Current Milestone Stage:</span>
                  <span className="font-semibold text-foreground">{loan.currentStage}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1.5 font-medium">
                    Central Admin Remarks:
                  </span>
                  {loan.adminRemarks ? (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                      {loan.adminRemarks}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                      No official administrative remarks recorded yet.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ========================================================================= */}
        {/* SECTION C: STATUS HISTORY & WORKFLOW TIMELINE                             */}
        {/* Example: Pending → Under Review → In Progress → Approved → Completed      */}
        {/* ========================================================================= */}
        <Card className="glass-card">
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <History className="h-4 w-4 text-primary" />
                <span>Workflow Status History & Transition Timeline</span>
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {loan.statusHistory?.length || 1} Event{(loan.statusHistory?.length || 1) > 1 ? "s" : ""}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Chronological log of workflow status progressions and administrative audits
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            {(!loan.statusHistory || loan.statusHistory.length === 0) ? (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-border/70">
                <div className="relative">
                  <div className="absolute -left-[29px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white ring-4 ring-background">
                    <CheckCircle2 className="h-3 w-3" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="warning" className="text-[11px] py-0 px-2 font-mono">
                        Pending
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Application originated at branch by {loan.createdBy?.name || "Branch Counselor"} on{" "}
                      {formatDateTime(loan.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-border/70">
                {loan.statusHistory.map((item, idx) => {
                  const isLatest = idx === (loan.statusHistory?.length || 0) - 1;

                  return (
                    <div key={item._id || String(idx)} className="relative">
                      {/* Timeline Dot */}
                      <div
                        className={`absolute -left-[29px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-white ring-4 ring-background ${
                          isLatest
                            ? "bg-primary shadow-xs"
                            : "bg-emerald-500"
                        }`}
                      >
                        {isLatest ? (
                          <Clock className="h-3 w-3" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                      </div>

                      {/* Content Card */}
                      <div className="rounded-xl border border-border/60 bg-card/40 p-3.5 backdrop-blur-sm space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          {/* Status Transition Pill: fromStatus -> toStatus */}
                          <div className="flex items-center gap-1.5">
                            {item.fromStatus && item.fromStatus !== "None" ? (
                              <>
                                <Badge variant={getStatusBadgeVariant(item.fromStatus)} className="text-[10px] py-0 px-1.5 font-medium">
                                  {item.fromStatus}
                                </Badge>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              </>
                            ) : null}
                            <Badge variant={getStatusBadgeVariant(item.toStatus)} className="text-[11px] py-0.5 px-2 font-semibold">
                              {item.toStatus}
                            </Badge>
                          </div>

                          {/* Timestamp */}
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {formatDateTime(item.timestamp)}
                          </span>
                        </div>

                        {/* Officer info */}
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                          <span>Authorized by:</span>
                          <strong className="text-foreground">
                            {item.changedByName || "System Official"}
                          </strong>
                        </div>

                        {/* Remark attached */}
                        {item.remarks && (
                          <p className="text-xs text-foreground/90 bg-muted/30 rounded-lg p-2 mt-1 italic border border-border/40">
                            &ldquo;{item.remarks}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SuperAdmin Data Correction Modal with Framer Motion */}
      <AnimatePresence>
        {isCorrectionOpen && loan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-md"
              onClick={() => setIsCorrectionOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border/80 bg-card/95 p-6 shadow-2xl backdrop-blur-2xl"
            >
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Edit2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    SuperAdmin Data Correction
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    Target Application: {loan.sdmId} ({loan.branchId?.name})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCorrectionOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCorrection} className="space-y-4 pt-4">
              {correctionError && (
                <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-400">
                  {correctionError}
                </div>
              )}

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  Elevated Governance Action
                </p>
                SuperAdmins have authorization to rectify incorrect student biographical details, financial requirements, or branch notes submitted in error. All edits will be logged with a timestamped diff in the audit trail.
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Student Full Name <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    required
                    value={corrStudentName}
                    onChange={(e) => setCorrStudentName(e.target.value)}
                    className="h-9 text-xs"
                    placeholder="Student Name"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Contact Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    required
                    value={corrContactNumber}
                    onChange={(e) => setCorrContactNumber(e.target.value)}
                    className="h-9 text-xs"
                    placeholder="+91 9876543210"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Degree / Course <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    required
                    value={corrCourse}
                    onChange={(e) => setCorrCourse(e.target.value)}
                    className="h-9 text-xs"
                    placeholder="M.S. Computer Science"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Destination Country <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    required
                    value={corrCountry}
                    onChange={(e) => setCorrCountry(e.target.value)}
                    className="h-9 text-xs"
                    placeholder="United States"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Sanction Amount (INR) <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    required
                    type="number"
                    min={1}
                    value={corrLoanAmount || ""}
                    onChange={(e) => setCorrLoanAmount(Number(e.target.value))}
                    className="h-9 text-xs font-mono"
                    placeholder="3500000"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Intake Month <span className="text-rose-500">*</span>
                  </label>
                  <Select
                    value={corrIntakeMonth}
                    onChange={(e) => setCorrIntakeMonth(e.target.value)}
                    className="h-9 text-xs"
                  >
                    {[
                      "January",
                      "February",
                      "March",
                      "April",
                      "May",
                      "June",
                      "July",
                      "August",
                      "September",
                      "October",
                      "November",
                      "December",
                    ].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Intake Year <span className="text-rose-500">*</span>
                  </label>
                  <Select
                    value={corrIntakeYear}
                    onChange={(e) => setCorrIntakeYear(Number(e.target.value))}
                    className="h-9 text-xs font-mono"
                  >
                    {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Parent / Guardian Income Source <span className="text-rose-500">*</span>
                </label>
                <Input
                  required
                  value={corrIncomeSource}
                  onChange={(e) => setCorrIncomeSource(e.target.value)}
                  className="h-9 text-xs"
                  placeholder="Salaried Senior Executive at Tech Corp"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Branch Counselor Application Remarks
                </label>
                <Textarea
                  value={corrBranchRemarks}
                  onChange={(e) => setCorrBranchRemarks(e.target.value)}
                  className="text-xs min-h-[70px] resize-y"
                  placeholder="Counselor remarks or notes..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCorrectionOpen(false)}
                  disabled={isSavingCorrection}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSavingCorrection}
                  className="gap-1.5"
                >
                  {isSavingCorrection ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving Corrections...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      <span>Save Corrections</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

      {/* SuperAdmin Delete Application Confirm Dialog */}
      {loan && (
        <ConfirmDialog
          isOpen={isDeleteConfirmOpen}
          onClose={() => setIsDeleteConfirmOpen(false)}
          title="Permanently Delete Application"
          description={`Are you sure you want to permanently delete application ${loan.sdmId} for student ${loan.studentName}? This action is irreversible and will remove all associated status history.`}
          confirmLabel="Permanently Delete"
          variant="destructive"
          isLoading={isDeleting}
          onConfirm={handleDeleteLoan}
        />
      )}
    </DashboardShell>
  );
}
