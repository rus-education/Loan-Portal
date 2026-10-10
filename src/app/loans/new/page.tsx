"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FilePlus2,
  User,
  GraduationCap,
  Briefcase,
  ArrowLeft,
  AlertCircle,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import {
  loanFormSchema,
  type LoanFormData,
  INTAKE_MONTHS,
  INTAKE_YEARS,
  WORKFLOW_STAGES,
  INCOME_SOURCES,
} from "@/lib/validations/loan";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api-client";

interface BranchOption {
  _id: string;
  name: string;
  code: string;
}

export default function NewLoanApplicationPage() {
  const router = useRouter();
  const { user: currentUser, isLoading: isLoadingUser } = useAuth();
  const [branches, setBranches] = React.useState<BranchOption[]>([]);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<LoanFormData>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: {
      sdmId: "",
      studentName: "",
      contactNumber: "",
      course: "",
      country: "",
      loanAmount: 1500000,
      intakeMonth: "September",
      intakeYear: 2026,
      parentGuardianIncomeSource: "Salaried (Private Sector)",
      currentStage: "Initial Inquiry",
      branchRemarks: "",
    },
  });

  const watchedAmount = useWatch({ control, name: "loanAmount" }) || 0;

  // Initialize branch values when user is loaded
  React.useEffect(() => {
    if (currentUser?.branchId) {
      setValue("branchId", currentUser.branchId);
      setValue("branchName", currentUser.branchName || "Assigned Branch");
    }
  }, [currentUser, setValue]);

  // Load branches list if needed
  React.useEffect(() => {
    if (isLoadingUser || !currentUser) return;

    async function loadBranches() {
      try {
        const branchRes = await apiFetch("/api/branches");
        if (branchRes.ok) {
          const bData = await branchRes.json();
          if (bData.success && Array.isArray(bData.data)) {
            setBranches(bData.data);
          }
        }
      } catch (err) {
        console.error("Failed to load branches:", err);
      }
    }
    loadBranches();
  }, [isLoadingUser, currentUser]);

  const onSubmit = async (data: LoanFormData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload: Record<string, unknown> = {
        sdmId: data.sdmId,
        studentName: data.studentName,
        contactNumber: data.contactNumber,
        course: data.course,
        country: data.country,
        loanAmount: Number(data.loanAmount),
        intakeMonth: data.intakeMonth,
        intakeYear: Number(data.intakeYear),
        parentGuardianIncomeSource: data.parentGuardianIncomeSource,
        currentStage: data.currentStage,
        branchRemarks: data.branchRemarks || "",
      };

      // If Superadmin, allow selecting branchId from form
      if (currentUser?.role === "SUPERADMIN" && data.branchId) {
        payload.branchId = data.branchId;
      }

      const res = await apiFetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();

      if (!res.ok || !resData.success) {
        setSubmitError(resData.error || "Failed to create loan application");
        setIsSubmitting(false);
        return;
      }

      // Successful creation: navigate to detail view
      toast.success("Loan application created successfully!");
      router.push(`/loans/${resData.data._id}`);
      router.refresh();
    } catch {
      setSubmitError("Network error occurred while submitting. Please try again.");
      setIsSubmitting(false);
    }
  };

  const isBranchUser = currentUser?.role === "BRANCH_USER";

  // Unauthorized access guard: Viewers and Admins cannot create loan files
  if (!isLoadingUser && currentUser && currentUser.role !== "SUPERADMIN" && currentUser.role !== "BRANCH_USER") {
    return (
      <DashboardShell initialUser={currentUser}>
        <div className="flex min-h-[65vh] items-center justify-center p-4">
          <Card className="glass-card max-w-md w-full text-center border-amber-500/20 p-6 md:p-8 shadow-xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 mb-4 ring-8 ring-amber-500/5">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <CardTitle className="text-xl font-bold text-foreground">
              Branch Officer Access Required
            </CardTitle>
            <CardDescription className="mt-2 text-sm text-muted-foreground">
              Loan application origination is designated for Branch Counselors and SuperAdmin accounts.
            </CardDescription>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/loans">
                <Button variant="default">View Loan Records</Button>
              </Link>
            </div>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell initialUser={currentUser}>
      <div className="space-y-6">
        {/* Navigation Breadcrumb / Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" asChild className="h-9 w-9">
              <Link href="/loans" aria-label="Back to loans list">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  New Loan Application
                </h1>
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {currentUser?.branchName || "Central Registry"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Register a new student client loan request into the management workflow
              </p>
            </div>
          </div>
        </div>

        {submitError && (
          <div className="flex items-center gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs text-destructive animate-in fade-in-50">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="font-medium">{submitError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* 1. Student Identity Section */}
            <Card className="glass-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <User className="h-4 w-4 text-primary" />
                  Student Identity & Contact
                </CardTitle>
                <CardDescription className="text-xs">
                  Applicant basic information and SDM ID reference
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* SDM ID */}
                <div className="space-y-1.5">
                  <Label required>SDM ID</Label>
                  <Input
                    placeholder="e.g. SDM-14726"
                    {...register("sdmId")}
                    disabled={isSubmitting}
                  />
                  {errors.sdmId && (
                    <p className="text-[11px] text-destructive">{errors.sdmId.message}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Unique Student Database Management identifier
                  </p>
                </div>

                {/* Student Name */}
                <div className="space-y-1.5">
                  <Label required>Student Full Name</Label>
                  <Input
                    placeholder="e.g. Aarav Sharma"
                    {...register("studentName")}
                    disabled={isSubmitting}
                  />
                  {errors.studentName && (
                    <p className="text-[11px] text-destructive">{errors.studentName.message}</p>
                  )}
                </div>

                {/* Contact Number */}
                <div className="space-y-1.5">
                  <Label required>Contact Number</Label>
                  <div className="relative">
                    <Input
                      type="tel"
                      placeholder="e.g. +91 98765 43210"
                      {...register("contactNumber")}
                      disabled={isSubmitting}
                    />
                  </div>
                  {errors.contactNumber && (
                    <p className="text-[11px] text-destructive">{errors.contactNumber.message}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    10-digit mobile or international dial format with country code
                  </p>
                </div>

                {/* Branch Name / Assignment */}
                <div className="space-y-1.5">
                  <Label required>Originating Branch</Label>
                  {isBranchUser ? (
                    <div className="flex h-9 w-full items-center justify-between rounded-lg border border-border/70 bg-muted/40 px-3 text-xs text-foreground">
                      <span className="font-semibold">{currentUser?.branchName || "Loading branch..."}</span>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider bg-background/60 px-1.5 py-0.5 rounded border border-border/50">
                        Locked to your branch
                      </span>
                    </div>
                  ) : (
                    <Select
                      {...register("branchId")}
                      disabled={isSubmitting || isLoadingUser}
                    >
                      <option value="">Select Branch</option>
                      {branches.map((b) => (
                        <option key={b._id} value={b._id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </Select>
                  )}
                  {errors.branchId && (
                    <p className="text-[11px] text-destructive">{errors.branchId.message}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Branch users are strictly isolated to their own branch
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 2. Educational & Loan Parameters */}
            <Card className="glass-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  Academic & Loan Details
                </CardTitle>
                <CardDescription className="text-xs">
                  Course target, destination country, and financial requirements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Course */}
                <div className="space-y-1.5">
                  <Label required>Course / Degree</Label>
                  <Input
                    placeholder="e.g. M.S. in Computer Science & AI"
                    {...register("course")}
                    disabled={isSubmitting}
                  />
                  {errors.course && (
                    <p className="text-[11px] text-destructive">{errors.course.message}</p>
                  )}
                </div>

                {/* Country */}
                <div className="space-y-1.5">
                  <Label required>Destination Country</Label>
                  <Input
                    placeholder="e.g. United States, United Kingdom, Germany"
                    {...register("country")}
                    disabled={isSubmitting}
                  />
                  {errors.country && (
                    <p className="text-[11px] text-destructive">{errors.country.message}</p>
                  )}
                </div>

                {/* Loan Amount Required */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label required>Loan Amount Required (₹)</Label>
                    {watchedAmount > 0 && (
                      <span className="text-xs font-bold text-primary">
                        {formatCurrency(Number(watchedAmount))}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      step="10000"
                      min="10000"
                      placeholder="e.g. 2500000"
                      {...register("loanAmount", { valueAsNumber: true })}
                      disabled={isSubmitting}
                    />
                  </div>
                  {errors.loanAmount && (
                    <p className="text-[11px] text-destructive">{errors.loanAmount.message}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Total loan requirement in Indian Rupees (INR)
                  </p>
                </div>

                {/* Intake Month & Year */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label required>Intake Month</Label>
                    <Select {...register("intakeMonth")} disabled={isSubmitting}>
                      {INTAKE_MONTHS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </Select>
                    {errors.intakeMonth && (
                      <p className="text-[11px] text-destructive">{errors.intakeMonth.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label required>Intake Year</Label>
                    <Select
                      {...register("intakeYear", { valueAsNumber: true })}
                      disabled={isSubmitting}
                    >
                      {INTAKE_YEARS.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </Select>
                    {errors.intakeYear && (
                      <p className="text-[11px] text-destructive">{errors.intakeYear.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3. Financial & Processing Details */}
            <Card className="glass-card md:col-span-2">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Briefcase className="h-4 w-4 text-primary" />
                  Financial Background & Initial Stage
                </CardTitle>
                <CardDescription className="text-xs">
                  Parent/Guardian sponsor background and initial onboarding stage
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Parent Income Source */}
                  <div className="space-y-1.5">
                    <Label required>Parent / Guardian Income Source</Label>
                    <Select {...register("parentGuardianIncomeSource")} disabled={isSubmitting}>
                      {INCOME_SOURCES.map((src) => (
                        <option key={src} value={src}>
                          {src}
                        </option>
                      ))}
                    </Select>
                    {errors.parentGuardianIncomeSource && (
                      <p className="text-[11px] text-destructive">
                        {errors.parentGuardianIncomeSource.message}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Co-applicant financial profile for banking evaluation
                    </p>
                  </div>

                  {/* Current Stage */}
                  <div className="space-y-1.5">
                    <Label required>Current Processing Stage</Label>
                    <Select {...register("currentStage")} disabled={isSubmitting}>
                      {WORKFLOW_STAGES.map((stg) => (
                        <option key={stg} value={stg}>
                          {stg}
                        </option>
                      ))}
                    </Select>
                    {errors.currentStage && (
                      <p className="text-[11px] text-destructive">{errors.currentStage.message}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Initial counseling / documentation milestone
                    </p>
                  </div>
                </div>

                {/* Remarks */}
                <div className="space-y-1.5">
                  <Label>Branch Counselor Remarks</Label>
                  <Textarea
                    placeholder="Enter any relevant observations, family background, academic profile, or special sponsor considerations..."
                    rows={3}
                    {...register("branchRemarks")}
                    disabled={isSubmitting}
                  />
                  {errors.branchRemarks && (
                    <p className="text-[11px] text-destructive">{errors.branchRemarks.message}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Initial observations visible to central administration for review
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-between rounded-xl border border-border/80 bg-card/60 p-4 backdrop-blur-xl">
            <Button variant="outline" size="sm" asChild disabled={isSubmitting}>
              <Link href="/loans">Cancel</Link>
            </Button>

            <div className="flex items-center gap-3">
              <Button
                type="submit"
                size="default"
                disabled={isSubmitting}
                className="gap-2 shadow-md hover:shadow-lg transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Submitting Application...</span>
                  </>
                ) : (
                  <>
                    <FilePlus2 className="h-4 w-4" />
                    <span>Submit Loan Request</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}
