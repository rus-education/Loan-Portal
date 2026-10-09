"use client";

import * as React from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  PlusCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Building2,
  Calendar,
  Sparkles,
  Download,
  Upload,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/feedback/empty-state";
import { TableSkeleton } from "@/components/feedback/table-skeleton";
import { toast } from "@/components/ui/toaster";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ImportCsvDialog } from "@/components/loans/import-csv-dialog";
import type { UserSession, WorkflowStatus } from "@/types";

interface LoanListItem {
  _id: string;
  sdmId: string;
  studentName: string;
  contactNumber: string;
  branchId: {
    _id: string;
    name: string;
    code: string;
  };
  course: string;
  country: string;
  loanAmount: number;
  intakeMonth: string;
  intakeYear: number;
  currentStage: string;
  status: WorkflowStatus;
  branchRemarks?: string;
  adminRemarks?: string;
  createdAt: string;
}

interface BranchItem {
  _id: string;
  name: string;
  code: string;
  status: string;
}

const INTAKE_MONTHS = [
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
];

const INTAKE_YEARS = [2024, 2025, 2026, 2027, 2028];

const DATE_PRESETS = [
  { id: "all", label: "All Time" },
  { id: "30d", label: "Last 30 Days" },
  { id: "90d", label: "Last 90 Days" },
  { id: "6m", label: "Last 6 Months" },
  { id: "1y", label: "This Year" },
  { id: "custom", label: "Custom Window" },
];

export default function LoansListPage() {
  const [currentUser, setCurrentUser] = React.useState<UserSession | null>(null);
  const [branches, setBranches] = React.useState<BranchItem[]>([]);
  const [loans, setLoans] = React.useState<LoanListItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isExporting, setIsExporting] = React.useState(false);
  const [isImportOpen, setIsImportOpen] = React.useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = React.useState(false);

  // Global search & targeted search
  const [searchTerm, setSearchTerm] = React.useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("search") || "";
    }
    return "";
  });
  const [sdmIdFilter, setSdmIdFilter] = React.useState("");
  const [studentNameFilter, setStudentNameFilter] = React.useState("");
  const [contactNumberFilter, setContactNumberFilter] = React.useState("");

  // Filters state
  const [statusFilter, setStatusFilter] = React.useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("status") || "";
    }
    return "";
  });
  const [branchFilter, setBranchFilter] = React.useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("branchId") || "";
    }
    return "";
  });
  const [intakeMonthFilter, setIntakeMonthFilter] = React.useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("intakeMonth") || "";
    }
    return "";
  });
  const [intakeYearFilter, setIntakeYearFilter] = React.useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("intakeYear") || "";
    }
    return "";
  });

  // Date filters
  const [dateRangeFilter, setDateRangeFilter] = React.useState("all");
  const [startDateFilter, setStartDateFilter] = React.useState("");
  const [endDateFilter, setEndDateFilter] = React.useState("");

  // Sorting state
  const [sortBy, setSortBy] = React.useState<string>("createdAt");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");

  // Server-side pagination state
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(15);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);
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
      .catch((err) => console.error(err));
  }, []);

  // 2. Fetch branches for branch filter dropdown (for Admin / Superadmin / Viewer)
  React.useEffect(() => {
    fetch("/api/branches")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.success && Array.isArray(data.data)) {
          setBranches(data.data);
        }
      })
      .catch((err) => console.error("Failed to load branches:", err));
  }, []);

  // 3. Fetch loans whenever filters, pagination, or sorting change
  React.useEffect(() => {
    let ignore = false;
    async function load() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        if (searchTerm.trim()) params.set("search", searchTerm.trim());
        if (sdmIdFilter.trim()) params.set("sdmId", sdmIdFilter.trim());
        if (studentNameFilter.trim()) params.set("studentName", studentNameFilter.trim());
        if (contactNumberFilter.trim()) params.set("contactNumber", contactNumberFilter.trim());
        if (statusFilter) params.set("status", statusFilter);
        if (branchFilter) params.set("branchId", branchFilter);
        if (intakeMonthFilter) params.set("intakeMonth", intakeMonthFilter);
        if (intakeYearFilter) params.set("intakeYear", intakeYearFilter);

        // Date range
        if (dateRangeFilter && dateRangeFilter !== "all") {
          params.set("dateRange", dateRangeFilter);
        }
        if (dateRangeFilter === "custom") {
          if (startDateFilter) params.set("startDate", startDateFilter);
          if (endDateFilter) params.set("endDate", endDateFilter);
        }

        params.set("sortBy", sortBy);
        params.set("sortOrder", sortOrder);

        const res = await fetch(`/api/loans?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (!ignore && data.success) {
            setLoans(data.data || []);
            setTotalPages(data.pagination?.totalPages || 1);
            setTotalCount(data.pagination?.total || 0);
          }
        }
      } catch (err) {
        console.error("Failed to fetch loans:", err);
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
  }, [
    page,
    limit,
    searchTerm,
    sdmIdFilter,
    studentNameFilter,
    contactNumberFilter,
    statusFilter,
    branchFilter,
    intakeMonthFilter,
    intakeYearFilter,
    dateRangeFilter,
    startDateFilter,
    endDateFilter,
    sortBy,
    sortOrder,
    reloadTrigger,
  ]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setReloadTrigger((r) => r + 1);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder(field === "studentName" || field === "sdmId" ? "asc" : "desc");
    }
    setPage(1);
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setSdmIdFilter("");
    setStudentNameFilter("");
    setContactNumberFilter("");
    setStatusFilter("");
    setBranchFilter("");
    setIntakeMonthFilter("");
    setIntakeYearFilter("");
    setDateRangeFilter("all");
    setStartDateFilter("");
    setEndDateFilter("");
    setSortBy("createdAt");
    setSortOrder("desc");
    setPage(1);
    toast.success("Filters reset to default view");
  };

  const hasActiveFilters = Boolean(
    searchTerm ||
      sdmIdFilter ||
      studentNameFilter ||
      contactNumberFilter ||
      statusFilter ||
      branchFilter ||
      intakeMonthFilter ||
      intakeYearFilter ||
      dateRangeFilter !== "all" ||
      startDateFilter ||
      endDateFilter
  );

  // CSV Export that strictly matches current filters
  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set("search", searchTerm.trim());
      if (sdmIdFilter.trim()) params.set("sdmId", sdmIdFilter.trim());
      if (studentNameFilter.trim()) params.set("studentName", studentNameFilter.trim());
      if (contactNumberFilter.trim()) params.set("contactNumber", contactNumberFilter.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (branchFilter) params.set("branchId", branchFilter);
      if (intakeMonthFilter) params.set("intakeMonth", intakeMonthFilter);
      if (intakeYearFilter) params.set("intakeYear", intakeYearFilter);

      if (dateRangeFilter && dateRangeFilter !== "all") {
        params.set("dateRange", dateRangeFilter);
      }
      if (dateRangeFilter === "custom") {
        if (startDateFilter) params.set("startDate", startDateFilter);
        if (endDateFilter) params.set("endDate", endDateFilter);
      }

      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      const downloadUrl = `/api/loans/export?${params.toString()}`;

      // Trigger download via anchor
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", `loan_applications_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("CSV export initiated. Download should begin shortly.");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to generate CSV export");
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusBadgeVariant = (st: WorkflowStatus) => {
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

  const renderSortIndicator = (field: string) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 inline ml-1" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="h-3 w-3 text-primary inline ml-1 font-bold" />
    ) : (
      <ArrowDown className="h-3 w-3 text-primary inline ml-1 font-bold" />
    );
  };

  const isBranchUser = currentUser?.role === "BRANCH_USER";
  const canImport = currentUser?.role === "SUPERADMIN" || currentUser?.role === "BRANCH_USER";

  return (
    <DashboardShell initialUser={currentUser}>
      <div className="space-y-6 pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Application Management
              </h1>
              {currentUser?.branchName ? (
                <Badge variant="outline" className="text-xs">
                  {currentUser.branchName}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Sparkles className="h-3 w-3 text-primary" />
                  All Regional Branches
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isBranchUser
                ? "Manage and monitor student loan applications originating from your assigned branch"
                : currentUser?.role === "VIEWER"
                ? "Read-only application oversight. Search, filter across 22 branches and intakes, sort records, and export dossiers."
                : "Central adjudication directory. Search, filter by branch & intake, sort records, export data, and update workflow status."}
            </p>
          </div>

          {/* Action Buttons: New App, CSV Export, CSV Import */}
          <div className="flex flex-wrap items-center gap-2">
            {/* CSV Export Button (Matches current active filters) */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={isExporting || totalCount === 0}
              className="gap-1.5 shadow-xs text-xs"
              title="Export current filtered view to CSV"
            >
              <Download className={`h-3.5 w-3.5 ${isExporting ? "animate-bounce" : ""}`} />
              <span>{isExporting ? "Exporting..." : "Export CSV"}</span>
            </Button>

            {/* CSV Import Button (SuperAdmin & Branch User) */}
            {canImport && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsImportOpen(true)}
                className="gap-1.5 shadow-xs text-xs"
                title="Batch import loan applications via CSV"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Import CSV</span>
              </Button>
            )}

            {/* New Application Creation */}
            {(isBranchUser || currentUser?.role === "SUPERADMIN") && (
              <Button size="sm" variant="gradient" asChild className="gap-2 shadow-xs text-xs">
                <Link href="/loans/new">
                  <PlusCircle className="h-4 w-4" />
                  <span>New Application</span>
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Multi-Dimensional Search & Filter Bar */}
        <Card className="glass-card">
          <CardContent className="p-4 space-y-3">
            {/* Top Row: Global Search & Action Buttons */}
            <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Global Search: SDM ID, Student Name, Contact Number, Course, Country..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <div className="flex w-full md:w-auto items-center gap-2">
                <Button type="submit" variant="default" size="sm" className="h-9 gap-1.5 px-3 text-xs">
                  <Filter className="h-3.5 w-3.5" />
                  <span>Search</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvancedSearch((prev) => !prev)}
                  className={`h-9 gap-1.5 text-xs ${showAdvancedSearch ? "bg-accent text-accent-foreground" : ""}`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Advanced</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${showAdvancedSearch ? "rotate-180" : ""}`} />
                </Button>

                {hasActiveFilters && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearAllFilters}
                    className="h-9 gap-1 text-xs"
                    title="Clear all active filters"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Reset</span>
                  </Button>
                )}
              </div>
            </form>

            {/* Targeted Search Drawer (SDM ID, Student Name, Phone Number) */}
            {showAdvancedSearch && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 pb-1 border-t border-border/60 animate-in fade-in-50 duration-150">
                <div>
                  <label htmlFor="sdmIdInput" className="text-[10px] font-semibold uppercase text-muted-foreground mb-1 block">
                    Specific SDM ID
                  </label>
                  <Input
                    id="sdmIdInput"
                    placeholder="e.g. SDM-2026-001"
                    value={sdmIdFilter}
                    onChange={(e) => {
                      setSdmIdFilter(e.target.value);
                      setPage(1);
                    }}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="studentNameInput" className="text-[10px] font-semibold uppercase text-muted-foreground mb-1 block">
                    Specific Student Name
                  </label>
                  <Input
                    id="studentNameInput"
                    placeholder="e.g. Aarav Sharma"
                    value={studentNameFilter}
                    onChange={(e) => {
                      setStudentNameFilter(e.target.value);
                      setPage(1);
                    }}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="contactNumberInput" className="text-[10px] font-semibold uppercase text-muted-foreground mb-1 block">
                    Specific Contact Number
                  </label>
                  <Input
                    id="contactNumberInput"
                    placeholder="e.g. +91 98111 22334"
                    value={contactNumberFilter}
                    onChange={(e) => {
                      setContactNumberFilter(e.target.value);
                      setPage(1);
                    }}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}

            {/* Dropdowns Row: Branch, Status, Intake Month, Intake Year */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
              {/* Branch Filter */}
              {!isBranchUser ? (
                <div>
                  <label htmlFor="branchSelect" className="text-[10px] font-semibold text-muted-foreground mb-1 block uppercase">
                    Branch Filter
                  </label>
                  <Select
                    id="branchSelect"
                    value={branchFilter}
                    onChange={(e) => {
                      setBranchFilter(e.target.value);
                      setPage(1);
                    }}
                    className="h-8 text-xs"
                  >
                    <option value="">All 22 Branches</option>
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.code} - {b.name}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : (
                <div>
                  <label htmlFor="assignedBranchInput" className="text-[10px] font-semibold text-muted-foreground mb-1 block uppercase">
                    Origination Branch
                  </label>
                  <div className="flex h-8 items-center rounded-lg border border-border/80 bg-muted/40 px-2.5 text-xs text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5 mr-1.5 text-primary" />
                    <span className="truncate">{currentUser?.branchName || "Assigned Branch"}</span>
                  </div>
                </div>
              )}

              {/* Status Filter */}
              <div>
                <label htmlFor="statusSelect" className="text-[10px] font-semibold text-muted-foreground mb-1 block uppercase">
                  Workflow Status
                </label>
                <Select
                  id="statusSelect"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 text-xs"
                >
                  <option value="">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Under Review">Under Review</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Completed">Completed</option>
                </Select>
              </div>

              {/* Intake Month */}
              <div>
                <label htmlFor="intakeMonthSelect" className="text-[10px] font-semibold text-muted-foreground mb-1 block uppercase">
                  Intake Month
                </label>
                <Select
                  id="intakeMonthSelect"
                  value={intakeMonthFilter}
                  onChange={(e) => {
                    setIntakeMonthFilter(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 text-xs"
                >
                  <option value="">All Intake Months</option>
                  {INTAKE_MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Intake Year */}
              <div>
                <label htmlFor="intakeYearSelect" className="text-[10px] font-semibold text-muted-foreground mb-1 block uppercase">
                  Intake Year
                </label>
                <Select
                  id="intakeYearSelect"
                  value={intakeYearFilter}
                  onChange={(e) => {
                    setIntakeYearFilter(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 text-xs"
                >
                  <option value="">All Intake Years</option>
                  {INTAKE_YEARS.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Date Filtering Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-border/60">
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase mr-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>Date:</span>
                </span>
                {DATE_PRESETS.map((preset) => {
                  const isActive = dateRangeFilter === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setDateRangeFilter(preset.id);
                        setPage(1);
                      }}
                      className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-all ${
                        isActive
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {/* Custom Date Pickers */}
              {dateRangeFilter === "custom" && (
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => {
                      setStartDateFilter(e.target.value);
                      setPage(1);
                    }}
                    className="h-7 text-[11px] w-32"
                    title="Start Date"
                  />
                  <span className="text-muted-foreground text-xs">to</span>
                  <Input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => {
                      setEndDateFilter(e.target.value);
                      setPage(1);
                    }}
                    className="h-7 text-[11px] w-32"
                    title="End Date"
                  />
                </div>
              )}

              {/* Current Active Filter Counter */}
              <div className="text-[11px] text-muted-foreground font-medium ml-auto">
                Found <span className="font-bold text-foreground">{totalCount}</span> application{totalCount === 1 ? "" : "s"}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loan Applications Data Table */}
        <Card className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-6">
                <TableSkeleton rows={8} columns={7} />
              </div>
            ) : loans.length === 0 ? (
              <EmptyState
                title="No loan applications found"
                description={
                  hasActiveFilters
                    ? "No records match your search or filter criteria. Try adjusting or resetting filters."
                    : "No loan applications have been submitted to the portal yet."
                }
                actionLabel={hasActiveFilters ? "Reset All Filters" : undefined}
                onAction={hasActiveFilters ? clearAllFilters : undefined}
              />
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/40 font-semibold text-muted-foreground">
                    <th
                      className="px-4 py-3 cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort("sdmId")}
                    >
                      <span>SDM ID</span>
                      {renderSortIndicator("sdmId")}
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort("studentName")}
                    >
                      <span>Student Details</span>
                      {renderSortIndicator("studentName")}
                    </th>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3">Course & Destination</th>
                    <th
                      className="px-4 py-3 text-right cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort("loanAmount")}
                    >
                      <span>Loan Amount</span>
                      {renderSortIndicator("loanAmount")}
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort("intakeYear")}
                    >
                      <span>Intake</span>
                      {renderSortIndicator("intakeYear")}
                    </th>
                    <th className="px-4 py-3">Current Stage</th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort("status")}
                    >
                      <span>Status</span>
                      {renderSortIndicator("status")}
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort("createdAt")}
                    >
                      <span>Created</span>
                      {renderSortIndicator("createdAt")}
                    </th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {loans.map((loan) => (
                    <tr
                      key={loan._id}
                      className="group transition-colors hover:bg-muted/40"
                    >
                      <td className="px-4 py-3 font-mono font-medium text-foreground">
                        <Link
                          href={`/loans/${loan._id}`}
                          className="hover:underline text-primary"
                        >
                          {loan.sdmId}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">{loan.studentName}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{loan.contactNumber}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {loan.branchId?.code || "BR"}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground truncate max-w-[130px]" title={loan.branchId?.name}>
                            {loan.branchId?.name || "Unknown Branch"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground truncate max-w-[160px]" title={loan.course}>
                          {loan.course}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{loan.country}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                        {formatCurrency(loan.loanAmount)}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-muted-foreground">
                        {loan.intakeMonth} {loan.intakeYear}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block max-w-[140px] truncate text-[11px] text-muted-foreground" title={loan.currentStage}>
                          {loan.currentStage}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={getStatusBadgeVariant(loan.status)} className="text-[11px]">
                          {loan.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-muted-foreground whitespace-nowrap">
                        {formatDate(loan.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" asChild className="h-8 px-2 gap-1 text-xs">
                          <Link href={`/loans/${loan._id}`}>
                            <Eye className="h-3.5 w-3.5" />
                            <span>View</span>
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Server-Side Pagination & Page Size Toolbar */}
          {!isLoading && loans.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-border/60 text-xs text-muted-foreground bg-muted/20">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <Select
                  value={String(limit)}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-7 w-16 text-xs"
                >
                  <option value="10">10</option>
                  <option value="15">15</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </Select>
                <span className="hidden sm:inline">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalCount)} of {totalCount} records
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="mr-2">
                  Page <span className="font-semibold text-foreground">{page}</span> of{" "}
                  <span className="font-semibold text-foreground">{totalPages}</span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-7 w-7 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-7 w-7 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* CSV Import Modal */}
      {canImport && (
        <ImportCsvDialog
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          onSuccess={() => {
            setReloadTrigger((r) => r + 1);
          }}
          userRole={currentUser?.role}
          userBranchCode={currentUser?.branchName || undefined}
        />
      )}
    </DashboardShell>
  );
}
