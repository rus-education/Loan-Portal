"use client";

import * as React from "react";
import {
  Building,
  PlusCircle,
  Search,
  Users,
  Edit2,
  Power,
  RefreshCw,
  Building2,
  IndianRupee,
  CheckCircle2,
  X,
  Loader2,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/feedback/empty-state";
import { TableSkeleton } from "@/components/feedback/table-skeleton";
import { toast } from "@/components/ui/toaster";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { useDebounce } from "@/hooks/use-debounce";
import { apiFetch } from "@/lib/api-client";
import type { UserSession } from "@/types";

interface BranchData {
  _id: string;
  name: string;
  code: string;
  status: "active" | "inactive";
  userCount: number;
  loanCount: number;
  totalLoanAmount: number;
  pendingLoanCount: number;
  approvedLoanCount: number;
  createdAt: string;
  updatedAt: string;
}

interface AssignedUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  lastLogin?: string | null;
}

export default function BranchesPage() {
  const { user: currentUser, isLoading: isAuthLoading } = useAuth();
  const [branches, setBranches] = React.useState<BranchData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [reloadTrigger, setReloadTrigger] = React.useState(0);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  const debouncedSearch = useDebounce(searchTerm, 300);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [createName, setCreateName] = React.useState("");
  const [createCode, setCreateCode] = React.useState("");
  const [createStatus, setCreateStatus] = React.useState<"active" | "inactive">("active");
  const [isCreating, setIsCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  const [editBranch, setEditBranch] = React.useState<BranchData | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editCode, setEditCode] = React.useState("");
  const [editStatus, setEditStatus] = React.useState<"active" | "inactive">("active");
  const [isEditing, setIsEditing] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  // Confirm dialog for status toggle
  const [toggleBranch, setToggleBranch] = React.useState<BranchData | null>(null);
  const [isToggling, setIsToggling] = React.useState(false);

  // Assigned users modal
  const [viewBranchUsers, setViewBranchUsers] = React.useState<BranchData | null>(null);
  const [assignedUsers, setAssignedUsers] = React.useState<AssignedUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = React.useState(false);

  // Success alert
  const [successBanner, setSuccessBanner] = React.useState<string | null>(null);

  // Fetch branches with aggregated stats
  React.useEffect(() => {
    if (isAuthLoading || !currentUser) return;

    let ignore = false;
    async function load() {
      setIsLoading(true);
      setFetchError(null);
      try {
        const params = new URLSearchParams();
        params.set("includeStats", "true");
        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
        if (statusFilter !== "all") params.set("status", statusFilter);

        const res = await apiFetch(`/api/branches?${params.toString()}`);
        const data = await res.json();
        if (!ignore && data?.success) {
          setBranches(data.data || []);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : "Failed to load branches";
          setFetchError(msg);
          console.error("Failed to load branches:", err);
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
  }, [isAuthLoading, currentUser, debouncedSearch, statusFilter, reloadTrigger]);

  // Load assigned users for selected branch
  React.useEffect(() => {
    if (!viewBranchUsers) {
      return;
    }
    let ignore = false;
    async function loadUsers() {
      setIsLoadingUsers(true);
      try {
        const res = await fetch(`/api/branches/${viewBranchUsers?._id}`);
        if (res.ok) {
          const data = await res.json();
          if (!ignore && data.success && data.data?.users) {
            setAssignedUsers(data.data.users);
          }
        }
      } catch (err) {
        console.error("Failed to fetch branch users:", err);
      } finally {
        if (!ignore) setIsLoadingUsers(false);
      }
    }
    loadUsers();
    return () => {
      ignore = true;
    };
  }, [viewBranchUsers]);

  // Aggregated KPI numbers
  const totalBranchesCount = branches.length;
  const activeBranchesCount = branches.filter((b) => b.status === "active").length;
  const totalLoanVolume = branches.reduce((acc, b) => acc + (b.totalLoanAmount || 0), 0);
  const totalBranchPersonnel = branches.reduce((acc, b) => acc + (b.userCount || 0), 0);

  // Handle Create Branch
  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateError(null);

    try {
      const res = await apiFetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          code: createCode.trim().toUpperCase(),
          status: createStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setCreateError(data.error || "Failed to create branch");
        return;
      }

      setIsCreateOpen(false);
      setCreateName("");
      setCreateCode("");
      setCreateStatus("active");
      toast.success(`Branch '${data.data.name}' (${data.data.code}) created successfully`);
      setSuccessBanner(`Branch '${data.data.name}' (${data.data.code}) created successfully.`);
      setTimeout(() => setSuccessBanner(null), 5000);
      setReloadTrigger((r) => r + 1);
    } catch {
      setCreateError("Network error occurred while creating branch");
      toast.error("Failed to create branch");
    } finally {
      setIsCreating(false);
    }
  };

  // Handle Edit Branch
  const handleUpdateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBranch) return;
    setIsEditing(true);
    setEditError(null);

    try {
      const res = await apiFetch(`/api/branches/${editBranch._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          code: editCode.trim().toUpperCase(),
          status: editStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setEditError(data.error || "Failed to update branch");
        return;
      }

      setEditBranch(null);
      toast.success(`Branch '${data.data.name}' updated successfully`);
      setSuccessBanner(`Branch '${data.data.name}' updated successfully.`);
      setTimeout(() => setSuccessBanner(null), 5000);
      setReloadTrigger((r) => r + 1);
    } catch {
      setEditError("Network error occurred while updating branch");
      toast.error("Failed to update branch");
    } finally {
      setIsEditing(false);
    }
  };

  // Handle Toggle Status (Activate / Deactivate)
  const handleConfirmToggle = async () => {
    if (!toggleBranch) return;
    setIsToggling(true);

    try {
      const nextStatus = toggleBranch.status === "active" ? "inactive" : "active";
      const res = await apiFetch(`/api/branches/${toggleBranch._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Branch '${toggleBranch.name}' marked as ${nextStatus.toUpperCase()}`);
        setSuccessBanner(
          `Branch '${toggleBranch.name}' marked as ${nextStatus.toUpperCase()}.`
        );
        setTimeout(() => setSuccessBanner(null), 5000);
        setReloadTrigger((r) => r + 1);
      } else {
        alert(data.error || "Failed to update branch status");
        toast.error(data.error || "Failed to update branch status");
      }
    } catch {
      alert("Network error occurred while toggling status");
      toast.error("Network error updating status");
    } finally {
      setIsToggling(false);
      setToggleBranch(null);
    }
  };

  return (
    <DashboardShell initialUser={currentUser}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Branch Network & Regional Centers
              </h1>
              <Badge variant="outline" className="text-xs">
                {branches.length} Branches
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              SuperAdmin governance: Provision regional centers, toggle active operations, inspect branch personnel, and track portfolio volume.
            </p>
          </div>

          <Button
            size="sm"
            onClick={() => {
              setCreateError(null);
              setIsCreateOpen(true);
            }}
            className="gap-2 shadow-sm"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Add New Branch</span>
          </Button>
        </div>

        {/* Success Alert Banner */}
        {successBanner && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="font-medium">{successBanner}</span>
          </div>
        )}

        {/* 4 Summary KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="glass-card">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Centers
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground font-mono">
                {totalBranchesCount}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Regional hubs in national network
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Active Operations
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground font-mono">
                {activeBranchesCount}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Currently originating applications
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Origination Volume
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
                <IndianRupee className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground font-mono truncate">
                {formatCurrency(totalLoanVolume)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Portfolio amount across all centers
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Branch Personnel
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <Users className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground font-mono">
                {totalBranchPersonnel}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Counselors & branch officers assigned
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar */}
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by Branch Name or Code (e.g. New Delhi, BOM, BLR)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <div className="flex w-full sm:w-auto items-center gap-2">
                <div className="w-40">
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-9 text-xs"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active Centers</option>
                    <option value="inactive">Inactive Centers</option>
                  </Select>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setReloadTrigger((r) => r + 1)}
                  className="h-9 w-9 text-muted-foreground hover:text-foreground"
                  title="Refresh branches"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Branches Directory Table */}
        <Card className="glass-card overflow-hidden">
          <CardHeader className="p-4 border-b border-border/60 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span>Regional Branches Directory</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Showing {branches.length} branches • Real-time origination statistics
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4">
                <TableSkeleton rows={8} columns={8} />
              </div>
            ) : branches.length === 0 ? (
              <EmptyState
                title="No branches found"
                description={
                  searchTerm || statusFilter !== "all"
                    ? "No branches match your active filter criteria."
                    : "No branches registered in the system yet."
                }
                actionLabel="Create Branch"
                onAction={() => setIsCreateOpen(true)}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/70 bg-muted/30 text-muted-foreground font-semibold">
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Branch Center Name</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Assigned Officers</th>
                      <th className="py-3 px-4 text-right">Loan Volume</th>
                      <th className="py-3 px-4">Applications</th>
                      <th className="py-3 px-4">Created Date</th>
                      <th className="py-3 px-4 text-right">Management Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {branches.map((b) => (
                      <tr key={b._id} className="transition-colors hover:bg-accent/40 group">
                        <td className="py-3 px-4 font-mono font-bold text-primary">
                          {b.code}
                        </td>
                        <td className="py-3 px-4 font-semibold text-foreground">
                          {b.name}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={b.status === "active" ? "success" : "secondary"}
                            className="text-[10px] capitalize"
                          >
                            {b.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => setViewBranchUsers(b)}
                            className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium text-foreground bg-accent/70 hover:bg-primary/20 hover:text-primary transition-colors"
                            title="Click to view assigned users"
                          >
                            <Users className="h-3 w-3" />
                            <span>{b.userCount} Officer{b.userCount === 1 ? "" : "s"}</span>
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-foreground">
                          {formatCurrency(b.totalLoanAmount || 0)}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          <span className="font-semibold text-foreground">{b.loanCount}</span> total{" "}
                          ({b.pendingLoanCount} pending, {b.approvedLoanCount} approved)
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {formatDate(b.createdAt)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditBranch(b);
                                setEditName(b.name);
                                setEditCode(b.code);
                                setEditStatus(b.status);
                                setEditError(null);
                              }}
                              className="h-8 gap-1 text-xs"
                            >
                              <Edit2 className="h-3.5 w-3.5 text-primary" />
                              <span>Edit</span>
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setToggleBranch(b)}
                              className={`h-8 gap-1 text-xs ${
                                b.status === "active"
                                  ? "text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                                  : "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                              }`}
                            >
                              <Power className="h-3.5 w-3.5" />
                              <span>{b.status === "active" ? "Deactivate" : "Activate"}</span>
                            </Button>
                          </div>
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

      {/* CREATE BRANCH MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsCreateOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Building className="h-4 w-4 text-primary" />
                <span>Create New Regional Branch</span>
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBranch} className="space-y-4 pt-4">
              {createError && (
                <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-400">
                  {createError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Branch Center Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  required
                  placeholder="E.g. Chandigarh Capitol, Bhopal MP Nagar"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Branch Code (2-6 Uppercase Letters) <span className="text-rose-500">*</span>
                </label>
                <Input
                  required
                  placeholder="E.g. IXC, BHO, NAG"
                  value={createCode}
                  onChange={(e) => setCreateCode(e.target.value.toUpperCase())}
                  className="h-9 text-xs font-mono uppercase"
                  maxLength={6}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Initial Operational Status</label>
                <Select
                  value={createStatus}
                  onChange={(e) => setCreateStatus(e.target.value as "active" | "inactive")}
                  className="h-9 text-xs"
                >
                  <option value="active">Active (Permit originations)</option>
                  <option value="inactive">Inactive (Suspended)</option>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isCreating}
                  className="text-xs h-9"
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isCreating} className="gap-1.5 text-xs h-9">
                  {isCreating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Create Branch</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT BRANCH MODAL */}
      {editBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setEditBranch(null)} />
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-primary" />
                <span>Edit Branch: {editBranch.name}</span>
              </h3>
              <button
                onClick={() => setEditBranch(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateBranch} className="space-y-4 pt-4">
              {editError && (
                <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-400">
                  {editError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Branch Center Name</label>
                <Input
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Branch Code</label>
                <Input
                  required
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                  className="h-9 text-xs font-mono uppercase"
                  maxLength={6}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Operational Status</label>
                <Select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as "active" | "inactive")}
                  className="h-9 text-xs"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditBranch(null)}
                  disabled={isEditing}
                  className="text-xs h-9"
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isEditing} className="gap-1.5 text-xs h-9">
                  {isEditing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW ASSIGNED USERS MODAL */}
      {viewBranchUsers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setViewBranchUsers(null)} />
          <div className="relative w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span>Personnel: {viewBranchUsers.name} ({viewBranchUsers.code})</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Officers registered and assigned to this regional branch
                </p>
              </div>
              <button
                onClick={() => setViewBranchUsers(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-4">
              {isLoadingUsers ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : assignedUsers.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="font-semibold text-foreground">No personnel currently assigned</p>
                  <p className="mt-1">
                    Assign branch officers via the User Management control center.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border/60 text-muted-foreground font-semibold">
                        <th className="py-2 px-3">Name</th>
                        <th className="py-2 px-3">Email & Contact</th>
                        <th className="py-2 px-3">Role</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Last Login</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {assignedUsers.map((u) => (
                        <tr key={u._id} className="hover:bg-accent/30">
                          <td className="py-2.5 px-3 font-semibold text-foreground">{u.name}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">
                            <div>{u.email}</div>
                            {u.phone && <div className="font-mono text-[10px]">{u.phone}</div>}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant="secondary" className="text-[10px] font-mono">
                              {u.role}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge
                              variant={u.status === "active" ? "success" : "secondary"}
                              className="text-[10px]"
                            >
                              {u.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground font-mono text-[11px]">
                            {u.lastLogin ? formatDate(u.lastLogin) : "Never"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-border/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewBranchUsers(null)}
                className="text-xs h-8"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM STATUS TOGGLE DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(toggleBranch)}
        onClose={() => setToggleBranch(null)}
        onConfirm={handleConfirmToggle}
        title={
          toggleBranch?.status === "active"
            ? `Deactivate ${toggleBranch?.name}?`
            : `Activate ${toggleBranch?.name}?`
        }
        description={
          toggleBranch?.status === "active"
            ? `Deactivating '${toggleBranch?.name}' (${toggleBranch?.code}) will block new loan applications originating from this branch. Existing records will remain accessible in read-only mode.`
            : `Activating '${toggleBranch?.name}' (${toggleBranch?.code}) will restore loan application origination privileges for this branch.`
        }
        confirmLabel={toggleBranch?.status === "active" ? "Deactivate Branch" : "Activate Branch"}
        variant={toggleBranch?.status === "active" ? "destructive" : "default"}
        isLoading={isToggling}
      />
    </DashboardShell>
  );
}
