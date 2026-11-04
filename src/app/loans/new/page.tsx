"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  User,
  GraduationCap,
  IndianRupee,
  Phone,
  Mail,
  MapPin,
  Clock,
  Award,
  Users,
  Building2,
  Globe,
  ArrowLeft,
  AlertCircle,
  Loader2,
  FilePlus2,
  Sparkles,
  MessageCircle,
} from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { WhatsAppShareDialog } from "@/components/loans/whatsapp-share-dialog";
import type { LoanWhatsAppPayload } from "@/lib/whatsapp";
import {
  loanFormSchema,
  type LoanFormData,
  INDIAN_STATES,
  CO_APPLICANT_RELATIONS,
  POPULAR_COUNTRIES,
  POPULAR_COURSES,
  COURSE_DURATIONS,
} from "@/lib/validations/loan";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api-client";

interface BranchOption {
  _id: string;
  name: string;
  code: string;
}

function formatIndianLakhsCrores(num: number | undefined): string {
  if (!num || isNaN(num) || num <= 0) return "";
  if (num >= 10000000) {
    const cr = (num / 10000000).toFixed(2).replace(/\.00$/, "");
    return `₹${cr} Crore`;
  }
  if (num >= 100000) {
    const lk = (num / 100000).toFixed(2).replace(/\.00$/, "");
    return `₹${lk} Lakh`;
  }
  if (num >= 1000) {
    const th = (num / 1000).toFixed(1).replace(/\.0$/, "");
    return `₹${th} Thousand`;
  }
  return `₹${num}`;
}

export default function NewLoanApplicationPage() {
  const router = useRouter();
  const { user: currentUser, isLoading: isLoadingUser } = useAuth();
  const [branches, setBranches] = React.useState<BranchOption[]>([]);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [whatsAppModalData, setWhatsAppModalData] = React.useState<LoanWhatsAppPayload | null>(null);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = React.useState(false);
  const [createdLoanId, setCreatedLoanId] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = useForm<LoanFormData>({
    resolver: zodResolver(loanFormSchema) as any,
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      studentName: "",
      contactNumber: "",
      email: "",
      state: "",
      pincode: "",
      residentialAddress: "",
      country: "Russia",
      universityCollege: "",
      course: "MBBS",
      courseDuration: "5.8 Years",
      loanAmount: 2500000,
      neetScore: null,
      coApplicantRelation: "Father",
      coApplicantDetails: "",
      branchRemarks: "",
    },
  });

  // Strictly block any non-digit key from being typed into integer/numeric fields
  const handleNumericKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      [
        "Backspace",
        "Delete",
        "Tab",
        "Escape",
        "Enter",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(e.key) ||
      ((e.ctrlKey || e.metaKey) && ["a", "c", "v", "x", "z"].includes(e.key.toLowerCase()))
    ) {
      return;
    }
    // Block any character that is not a numeric digit (0-9)
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  // Block digits from being typed into student name
  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      [
        "Backspace",
        "Delete",
        "Tab",
        "Escape",
        "Enter",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(e.key) ||
      ((e.ctrlKey || e.metaKey) && ["a", "c", "v", "x", "z"].includes(e.key.toLowerCase()))
    ) {
      return;
    }
    // Block numbers 0-9
    if (/[0-9]/.test(e.key)) {
      e.preventDefault();
    }
  };

  const watchedAmount = useWatch({ control, name: "loanAmount" }) || 0;
  const watchedCountry = useWatch({ control, name: "country" }) || "";
  const watchedCourse = useWatch({ control, name: "course" }) || "";

  // Set default branch for branch officers
  React.useEffect(() => {
    if (currentUser?.branchId) {
      setValue("branchId", currentUser.branchId);
      setValue("branchName", currentUser.branchName || "Assigned Branch");
    }
  }, [currentUser, setValue]);

  // Load branches if Superadmin
  React.useEffect(() => {
    if (isLoadingUser || !currentUser || currentUser.role !== "SUPERADMIN") return;

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
        studentName: data.studentName.trim(),
        contactNumber: data.contactNumber.trim(),
        email: data.email.trim().toLowerCase(),
        state: data.state.trim(),
        pincode: data.pincode.trim(),
        residentialAddress: data.residentialAddress.trim(),
        country: data.country.trim(),
        universityCollege: data.universityCollege.trim(),
        course: data.course.trim(),
        courseDuration: data.courseDuration.trim(),
        loanAmount: Number(data.loanAmount),
        neetScore:
          data.neetScore !== undefined && data.neetScore !== null && !isNaN(Number(data.neetScore))
            ? Number(data.neetScore)
            : null,
        coApplicantRelation: data.coApplicantRelation.trim(),
        coApplicantDetails: data.coApplicantDetails.trim(),
        branchRemarks: data.branchRemarks?.trim() || "",
        currentStage: "Initial Inquiry",
      };

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

      const createdId = resData.data?._id;
      const createdSdmId = resData.data?.sdmId || "";
      const branchLabel =
        resData.data?.branchId?.name ||
        branches.find((b) => b._id === data.branchId)?.name ||
        currentUser?.branchName ||
        "Branch Office";

      toast.success("Student loan application submitted successfully!");
      setCreatedLoanId(createdId);
      setWhatsAppModalData({
        studentName: data.studentName.trim(),
        contactNumber: data.contactNumber.trim(),
        email: data.email.trim(),
        state: data.state.trim(),
        pincode: data.pincode.trim(),
        residentialAddress: data.residentialAddress.trim(),
        country: data.country.trim(),
        universityCollege: data.universityCollege.trim(),
        course: data.course.trim(),
        courseDuration: data.courseDuration.trim(),
        loanAmount: Number(data.loanAmount),
        neetScore:
          data.neetScore !== undefined && data.neetScore !== null && !isNaN(Number(data.neetScore))
            ? Number(data.neetScore)
            : null,
        coApplicantRelation: data.coApplicantRelation.trim(),
        coApplicantDetails: data.coApplicantDetails.trim(),
        sdmId: createdSdmId,
        branchName: branchLabel,
      });
      setIsWhatsAppOpen(true);
      setIsSubmitting(false);
    } catch {
      setSubmitError("Network error occurred while submitting. Please try again.");
      setIsSubmitting(false);
    }
  };

  const isBranchUser = currentUser?.role === "BRANCH_USER";

  return (
    <DashboardShell initialUser={currentUser}>
      <div className="space-y-6">
        {/* Header Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" asChild className="h-9 w-9 shrink-0">
              <Link href="/loans" aria-label="Back to Loan Management">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  New Student Loan Application
                </h1>
                <Badge variant="outline" className="text-xs">
                  {isBranchUser ? currentUser?.branchName || "Branch Workstation" : "Central Intake"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quick customer intake form for student education loan processing (India)
              </p>
            </div>
          </div>
        </div>

        {submitError && (
          <div className="flex items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive animate-in fade-in-50">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="font-medium">{submitError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit((data) => onSubmit(data as LoanFormData))} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* 1. Student & Contact Details */}
            <Card className="glass-card shadow-xs">
              <CardHeader className="pb-4 border-b border-border/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <User className="h-4 w-4 text-primary" />
                  <span>1. Student Information</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Primary applicant personal credentials as per government ID
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {/* Student Name */}
                <div className="space-y-1.5">
                  <Label required>Student Name</Label>
                  <div className="relative flex items-center">
                    <User className="absolute left-3.5 h-4 w-4 text-primary pointer-events-none z-10" />
                    <Input
                      placeholder="e.g. Aarav Sharma"
                      className={`pl-10 text-sm ${errors.studentName ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                      {...register("studentName", {
                        onChange: (e) => {
                          const sanitized = e.target.value.replace(/[0-9]/g, "");
                          e.target.value = sanitized;
                          setValue("studentName", sanitized, { shouldValidate: true });
                        },
                      })}
                      onKeyDown={handleNameKeyDown}
                      disabled={isSubmitting}
                    />
                  </div>
                  {errors.studentName && (
                    <p className="text-[11px] text-destructive">{errors.studentName.message}</p>
                  )}
                </div>

                {/* Contact Number & Email */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label required>Contact Number</Label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3 z-10 flex items-center gap-1.5 pointer-events-none select-none text-xs font-semibold text-foreground/80 border-r border-border pr-2">
                        <Phone className="h-3.5 w-3.5 text-primary" />
                        <span>+91</span>
                      </div>
                      <Input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="9876543210"
                        className={`pl-20 font-mono text-sm tracking-wide ${errors.contactNumber ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                        {...register("contactNumber", {
                          onChange: (e) => {
                            let digits = e.target.value.replace(/\D/g, "");
                            if (digits.startsWith("91") && digits.length === 12) {
                              digits = digits.slice(2);
                            } else if (digits.startsWith("0") && digits.length === 11) {
                              digits = digits.slice(1);
                            }
                            digits = digits.slice(0, 10);
                            e.target.value = digits;
                            setValue("contactNumber", digits, { shouldValidate: true });
                          },
                        })}
                        onKeyDown={handleNumericKeyDown}
                        disabled={isSubmitting}
                      />
                    </div>
                    {errors.contactNumber && (
                      <p className="text-[11px] text-destructive">{errors.contactNumber.message}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">10-digit Indian mobile number</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label required>Email ID</Label>
                    <div className="relative flex items-center">
                      <Mail className="absolute left-3.5 h-4 w-4 text-primary pointer-events-none z-10" />
                      <Input
                        type="email"
                        placeholder="student.parent@gmail.com"
                        className={`pl-10 text-sm ${errors.email ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                        {...register("email")}
                        disabled={isSubmitting}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-[11px] text-destructive">{errors.email.message}</p>
                    )}
                  </div>
                </div>

                {/* State & 6 Digit Pincode (Placed above Residential Address) */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label required>State</Label>
                    <Select
                      {...register("state")}
                      className={errors.state ? "border-destructive focus-visible:ring-destructive/30" : ""}
                      disabled={isSubmitting}
                    >
                      <option value="">Select State / UT</option>
                      {INDIAN_STATES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                    {errors.state && (
                      <p className="text-[11px] text-destructive">{errors.state.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label required>6 Digit Pincode</Label>
                    <div className="relative flex items-center">
                      <MapPin className="absolute left-3.5 h-4 w-4 text-primary pointer-events-none z-10" />
                      <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="e.g. 110001"
                        className={`pl-10 font-mono text-sm tracking-widest font-semibold ${errors.pincode ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                        {...register("pincode", {
                          onChange: (e) => {
                            const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                            e.target.value = digits;
                            setValue("pincode", digits, { shouldValidate: true });
                          },
                        })}
                        onKeyDown={handleNumericKeyDown}
                        disabled={isSubmitting}
                      />
                    </div>
                    {errors.pincode && (
                      <p className="text-[11px] text-destructive">{errors.pincode.message}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">Standard 6-digit Indian Postal PIN code</p>
                  </div>
                </div>

                {/* Residential Address as per Aadhaar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label required>Residential Address (as mentioned in Aadhaar)</Label>
                    <Badge variant="outline" className="text-[10px] font-normal py-0">
                      Aadhaar Record
                    </Badge>
                  </div>
                  <Textarea
                    placeholder="Enter permanent house/flat no., street, landmark, city as printed on Aadhaar card..."
                    rows={3}
                    className={`text-sm resize-none ${errors.residentialAddress ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                    {...register("residentialAddress")}
                    disabled={isSubmitting}
                  />
                  {errors.residentialAddress && (
                    <p className="text-[11px] text-destructive">{errors.residentialAddress.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 2. Academic & Course Details */}
            <Card className="glass-card shadow-xs">
              <CardHeader className="pb-4 border-b border-border/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  <span>2. Admission & University Details</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Target overseas university, degree program, and entrance qualification
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {/* Country Applied */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label required>Country Applied</Label>
                    <span className="text-[10px] text-muted-foreground">Popular destinations:</span>
                  </div>
                  <div className="relative flex items-center">
                    <Globe className="absolute left-3.5 h-4 w-4 text-primary pointer-events-none z-10" />
                    <Input
                      list="country-suggestions"
                      placeholder="e.g. Russia, Georgia, Kazakhstan..."
                      className={`pl-10 text-sm ${errors.country ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                      {...register("country")}
                      disabled={isSubmitting}
                    />
                  </div>
                  <datalist id="country-suggestions">
                    {POPULAR_COUNTRIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {POPULAR_COUNTRIES.slice(0, 5).map((c) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setValue("country", c, { shouldValidate: true })}
                        className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-all ${
                          watchedCountry === c
                            ? "bg-primary text-primary-foreground border-primary font-medium shadow-xs"
                            : "bg-muted/50 hover:bg-muted text-muted-foreground border-border/60"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  {errors.country && (
                    <p className="text-[11px] text-destructive">{errors.country.message}</p>
                  )}
                </div>

                {/* University / College */}
                <div className="space-y-1.5">
                  <Label required>University / College</Label>
                  <div className="relative flex items-center">
                    <Building2 className="absolute left-3.5 h-4 w-4 text-primary pointer-events-none z-10" />
                    <Input
                      placeholder="e.g. Bashkir State Medical University"
                      className={`pl-10 text-sm ${errors.universityCollege ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                      {...register("universityCollege")}
                      disabled={isSubmitting}
                    />
                  </div>
                  {errors.universityCollege && (
                    <p className="text-[11px] text-destructive">{errors.universityCollege.message}</p>
                  )}
                </div>

                {/* Course Applied & Duration */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label required>Course Applied</Label>
                    <div className="relative flex items-center">
                      <GraduationCap className="absolute left-3.5 h-4 w-4 text-primary pointer-events-none z-10" />
                      <Input
                        list="course-suggestions"
                        placeholder="e.g. MBBS"
                        className={`pl-10 text-sm ${errors.course ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                        {...register("course")}
                        disabled={isSubmitting}
                      />
                    </div>
                    <datalist id="course-suggestions">
                      {POPULAR_COURSES.map((cr) => (
                        <option key={cr} value={cr} />
                      ))}
                    </datalist>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {["MBBS", "MD", "BDS"].map((cr) => (
                        <button
                          type="button"
                          key={cr}
                          onClick={() => setValue("course", cr, { shouldValidate: true })}
                          className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-all ${
                            watchedCourse === cr
                              ? "bg-primary text-primary-foreground border-primary font-medium shadow-xs"
                              : "bg-muted/50 hover:bg-muted text-muted-foreground border-border/60"
                          }`}
                        >
                          {cr}
                        </button>
                      ))}
                    </div>
                    {errors.course && (
                      <p className="text-[11px] text-destructive">{errors.course.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label required>Course Duration</Label>
                    <Select {...register("courseDuration")} disabled={isSubmitting}>
                      {COURSE_DURATIONS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </Select>
                    {errors.courseDuration && (
                      <p className="text-[11px] text-destructive">{errors.courseDuration.message}</p>
                    )}
                  </div>
                </div>

                {/* NEET Score */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>NEET Score</Label>
                    <Badge variant="outline" className="text-[10px] font-normal py-0">
                      Max: 720 Marks
                    </Badge>
                  </div>
                  <div className="relative flex items-center max-w-[220px]">
                    <Award className="absolute left-3.5 h-4 w-4 text-amber-500 pointer-events-none z-10" />
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={3}
                      placeholder="e.g. 520"
                      className={`pl-10 font-mono text-sm ${errors.neetScore ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                      {...register("neetScore", {
                        setValueAs: (v) => (v === "" || v === null || isNaN(Number(v)) ? null : Number(v)),
                        onChange: (e) => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
                          e.target.value = digits;
                          setValue("neetScore", digits === "" ? null : Number(digits), { shouldValidate: true });
                        },
                      })}
                      onKeyDown={handleNumericKeyDown}
                      disabled={isSubmitting}
                    />
                  </div>
                  {errors.neetScore && (
                    <p className="text-[11px] text-destructive">{errors.neetScore.message}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    National Eligibility cum Entrance Test qualification score (0-720)
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 3. Loan Requirement & Co-Applicant Particulars */}
            <Card className="glass-card shadow-xs lg:col-span-2">
              <CardHeader className="pb-4 border-b border-border/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <IndianRupee className="h-4 w-4 text-emerald-500" />
                  <span>3. Loan Requirement & Co-Applicant (Parent / Customer) Details</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Financial requirement in INR and parent co-borrower background
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-4">
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Loan Requirement (₹) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label required>Loan Requirement (₹)</Label>
                      {watchedAmount > 0 && (
                        <span className="text-xs font-bold text-primary px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                          {formatCurrency(Number(watchedAmount))} • {formatIndianLakhsCrores(Number(watchedAmount))}
                        </span>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 z-10 flex items-center pointer-events-none select-none text-emerald-600 dark:text-emerald-400 font-bold text-base">
                        ₹
                      </span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="e.g. 2500000"
                        className={`pl-9 font-mono text-base font-semibold ${errors.loanAmount ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                        {...register("loanAmount", {
                          setValueAs: (v) => (v === "" || isNaN(Number(v)) ? 0 : Number(v)),
                          onChange: (e) => {
                            const digits = e.target.value.replace(/\D/g, "");
                            e.target.value = digits;
                            setValue("loanAmount", Number(digits || 0), { shouldValidate: true });
                          },
                        })}
                        onKeyDown={handleNumericKeyDown}
                        disabled={isSubmitting}
                      />
                    </div>
                    {errors.loanAmount && (
                      <p className="text-[11px] text-destructive">{errors.loanAmount.message}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[1500000, 2000000, 2500000, 3000000, 4000000].map((amt) => (
                        <button
                          type="button"
                          key={amt}
                          onClick={() => setValue("loanAmount", amt, { shouldValidate: true })}
                          className="text-[10px] px-2 py-0.5 rounded-md border border-border/60 bg-muted/40 hover:bg-muted text-muted-foreground transition-colors"
                        >
                          ₹{(amt / 100000).toFixed(0)} Lakhs
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Co-Applicant Relation (separate field) */}
                  <div className="space-y-2">
                    <Label required>Co-Applicant Relation (Different Field)</Label>
                    <Select {...register("coApplicantRelation")} disabled={isSubmitting}>
                      {CO_APPLICANT_RELATIONS.map((rel) => (
                        <option key={rel} value={rel}>
                          {rel}
                        </option>
                      ))}
                    </Select>
                    {errors.coApplicantRelation && (
                      <p className="text-[11px] text-destructive">{errors.coApplicantRelation.message}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      Relationship of primary co-borrower/financial guarantor to the student
                    </p>
                  </div>
                </div>

                {/* Brief details about Co Applicant */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label required>Brief Details about Co-Applicant</Label>
                    <span className="text-[10px] text-muted-foreground">Customer / Parent Profile</span>
                  </div>
                  <Textarea
                    placeholder="Enter Co-Applicant Name, Occupation (e.g. Govt Employee / Farmer / Businessman), Monthly/Annual Income, Employer/Business name, and any collateral/property details..."
                    rows={3}
                    className={`text-xs resize-none ${errors.coApplicantDetails ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                    {...register("coApplicantDetails")}
                    disabled={isSubmitting}
                  />
                  {errors.coApplicantDetails && (
                    <p className="text-[11px] text-destructive">{errors.coApplicantDetails.message}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    Brief customer financial summary for bank loan sanctioning
                  </p>
                </div>

                {/* Originating Branch (Locked to branch for branch user, selectable by SuperAdmin) */}
                {!isBranchUser && (
                  <div className="space-y-1.5 pt-2 border-t border-border/50">
                    <Label>Assign Originating Branch (SuperAdmin)</Label>
                    <Select {...register("branchId")} disabled={isSubmitting}>
                      <option value="">Select Branch</option>
                      {branches.map((b) => (
                        <option key={b._id} value={b._id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card/60 p-4 backdrop-blur-xl shadow-xs">
            <Button variant="outline" size="sm" asChild disabled={isSubmitting}>
              <Link href="/loans">Cancel</Link>
            </Button>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="default"
                disabled={isSubmitting}
                onClick={() => {
                  const currentVals = getValues();
                  const branchLabel =
                    branches.find((b) => b._id === currentVals.branchId)?.name ||
                    currentUser?.branchName ||
                    "Branch Office";

                  setCreatedLoanId(null);
                  setWhatsAppModalData({
                    studentName: currentVals.studentName?.trim() || "Prospective Student",
                    contactNumber: currentVals.contactNumber?.trim() || "",
                    email: currentVals.email?.trim() || "",
                    state: currentVals.state?.trim() || "",
                    pincode: currentVals.pincode?.trim() || "",
                    residentialAddress: currentVals.residentialAddress?.trim() || "",
                    country: currentVals.country?.trim() || "",
                    universityCollege: currentVals.universityCollege?.trim() || "",
                    course: currentVals.course?.trim() || "",
                    courseDuration: currentVals.courseDuration?.trim() || "",
                    loanAmount: Number(currentVals.loanAmount) || 0,
                    neetScore:
                      currentVals.neetScore !== undefined &&
                      currentVals.neetScore !== null &&
                      !isNaN(Number(currentVals.neetScore))
                        ? Number(currentVals.neetScore)
                        : null,
                    coApplicantRelation: currentVals.coApplicantRelation?.trim() || "",
                    coApplicantDetails: currentVals.coApplicantDetails?.trim() || "",
                    branchName: branchLabel,
                  });
                  setIsWhatsAppOpen(true);
                }}
                className="gap-2 text-xs font-semibold text-[#25D366] hover:text-[#25D366] hover:bg-[#25D366]/10 border-[#25D366]/30 transition-colors shadow-xs"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Preview WhatsApp Template</span>
              </Button>

              <Button
                type="submit"
                size="default"
                disabled={isSubmitting}
                className="gap-2 shadow-sm font-semibold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Submitting Customer Details...</span>
                  </>
                ) : (
                  <>
                    <FilePlus2 className="h-4 w-4" />
                    <span>Submit Loan Application</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* WhatsApp Template Sharing Dialog */}
      <WhatsAppShareDialog
        isOpen={isWhatsAppOpen}
        onClose={() => {
          setIsWhatsAppOpen(false);
          if (createdLoanId) {
            router.push(`/loans/${createdLoanId}`);
            router.refresh();
          }
        }}
        data={whatsAppModalData}
        onContinue={
          createdLoanId
            ? () => {
                setIsWhatsAppOpen(false);
                router.push(`/loans/${createdLoanId}`);
                router.refresh();
              }
            : undefined
        }
        continueLabel="Proceed to Application Dossier"
      />
    </DashboardShell>
  );
}
