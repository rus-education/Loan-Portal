"use client";

import * as React from "react";
import {
  Users,
  PlusCircle,
  Search,
  KeyRound,
  Edit2,
  Power,
  RefreshCw,
  Building2,
  ShieldCheck,
  CheckCircle2,
  X,
  Loader2,
  Clock,
  Eye,
  Check,
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
import { formatDate, formatDateTime } from "@/lib/utils";
import type { UserRole, UserSession } from "@/types";

interface UserItem {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  branchId?: {
    _id: string;
    name: string;
    code: string;
    status: string;
  } | null;
  status: "active" | "inactive";
  lastLogin?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BranchOption {
  _id: string;
  name: string;
  code: string;
  status: string;
}

export default function UserManagementPage() {
  const [currentUser, setCurrentUser] = React.useState<UserSession | null>(null);
  const [users, setUsers] = React.useState<UserItem[]>([]);
  const [branches, setBranches] = React.useState<BranchOption[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Filters state with lazy initialization
  const [searchTerm, setSearchTerm] = React.useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("search") || "";
    }
    return "";
  });
  const [roleFilter, setRoleFilter] = React.useState<string>(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("role") || "ALL";
    }
    return "ALL";
  });
  const [branchFilter, setBranchFilter] = React.useState<string>("ALL");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [reloadTrigger, setReloadTrigger] = React.useState(0);

  // Create User Modal
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [createName, setCreateName] = React.useState("");
  const [createEmail, setCreateEmail] = React.useState("");
  const [createPhone, setCreatePhone] = React.useState("");
  const [createPassword, setCreatePassword] = React.useState("");
  const [createRole, setCreateRole] = React.useState<UserRole>("BRANCH_USER");
  const [createBranchId, setCreateBranchId] = React.useState("");
  const [createStatus, setCreateStatus] = React.useState<"active" | "inactive">("active");
  const [isCreating, setIsCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  // Edit User Modal
  const [editUser, setEditUser] = React.useState<UserItem | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editEmail, setEditEmail] = React.useState("");
  const [editPhone, setEditPhone] = React.useState("");
  const [editRole, setEditRole] = React.useState<UserRole>("BRANCH_USER");
  const [editBranchId, setEditBranchId] = React.useState<string>("");
  const [editStatus, setEditStatus] = React.useState<"active" | "inactive">("active");
  const [isEditing, setIsEditing] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  // Reset Password Modal
  const [resetUser, setResetUser] = React.useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = React.useState("");
  const [isResetting, setIsResetting] = React.useState(false);
  const [resetError, setResetError] = React.useState<string | null>(null);

  // Confirm Status Toggle Dialog
  const [toggleUser, setToggleUser] = React.useState<UserItem | null>(null);
  const [isToggling, setIsToggling] = React.useState(false);

  // Feedback Notification Banner
  const [successBanner, setSuccessBanner] = React.useState<string | null>(null);

  // 1. Fetch current session user
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

  // 2. Fetch branches for branch assignment dropdowns
  React.useEffect(() => {
    fetch("/api/branches")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.success && Array.isArray(data.data)) {
          setBranches(data.data);
        }
      })
      .catch((err) => console.error("Branches error:", err));
  }, []);

  // 3. Fetch users based on filters
  React.useEffect(() => {
    let ignore = false;
    async function load() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchTerm.trim()) params.set("search", searchTerm.trim());
        if (roleFilter !== "ALL") params.set("role", roleFilter);
        if (branchFilter !== "ALL") params.set("branchId", branchFilter);
        if (statusFilter !== "ALL") params.set("status", statusFilter);

        const res = await fetch(`/api/users?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (!ignore && data.success) {
            setUsers(data.data || []);
          }
        }
      } catch (err) {
        console.error("Failed to load users:", err);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [searchTerm, roleFilter, branchFilter, statusFilter, reloadTrigger]);

  // Metric counts
  const totalUsersCount = users.length;
  const activeCount = users.filter((u) => u.status === "active").length;
  const branchOfficersCount = users.filter((u) => u.role === "BRANCH_USER").length;
  const adminOfficersCount = users.filter((u) => u.role === "ADMIN").length;
  const viewersCount = users.filter((u) => u.role === "VIEWER").length;

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case "SUPERADMIN":
        return "purple" as const;
      case "ADMIN":
        return "default" as const;
      case "BRANCH_USER":
        return "info" as const;
      case "VIEWER":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  };

  // Handle Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateError(null);

    if (createRole === "BRANCH_USER" && !createBranchId) {
      setCreateError("Branch Officers must be assigned to an active branch.");
      setIsCreating(false);
      return;
    }

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          email: createEmail.trim().toLowerCase(),
          phone: createPhone.trim(),
          password: createPassword,
          role: createRole,
          branchId: createRole === "BRANCH_USER" ? createBranchId : null,
          status: createStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setCreateError(data.error || "Failed to create user account");
        return;
      }

      setIsCreateOpen(false);
      setCreateName("");
      setCreateEmail("");
      setCreatePhone("");
      setCreatePassword("");
      setCreateRole("BRANCH_USER");
      setCreateBranchId("");
      toast.success(`User '${data.data.name}' created successfully`);
      setSuccessBanner(`User '${data.data.name}' (${data.data.role}) created successfully.`);
      setTimeout(() => setSuccessBanner(null), 5000);
      setReloadTrigger((r) => r + 1);
    } catch {
      setCreateError("Network error occurred while creating user");
      toast.error("Failed to create user account");
    } finally {
      setIsCreating(false);
    }
  };

  // Handle Edit User
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setIsEditing(true);
    setEditError(null);

    if (editRole === "BRANCH_USER" && !editBranchId) {
      setEditError("Branch Officers must be assigned to an active branch.");
      setIsEditing(false);
      return;
    }

    try {
      const res = await fetch(`/api/users/${editUser._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim().toLowerCase(),
          phone: editPhone.trim(),
          role: editRole,
          branchId: editRole === "BRANCH_USER" ? editBranchId : null,
          status: editStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setEditError(data.error || "Failed to update user profile");
        return;
      }

      setEditUser(null);
      toast.success(`User '${data.data.name}' updated successfully`);
      setSuccessBanner(`User '${data.data.name}' updated successfully.`);
      setTimeout(() => setSuccessBanner(null), 5000);
      setReloadTrigger((r) => r + 1);
    } catch {
      setEditError("Network error occurred while updating user");
      toast.error("Failed to update user profile");
    } finally {
      setIsEditing(false);
    }
  };

  // Handle Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser) return;
    setIsResetting(true);
    setResetError(null);

    try {
      const res = await fetch(`/api/users/${resetUser._id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setResetError(data.error || "Failed to reset password");
        return;
      }

      setResetUser(null);
      setNewPassword("");
      toast.success(`Password for '${resetUser.name}' reset successfully`);
      setSuccessBanner(`Password for '${resetUser.name}' reset successfully.`);
      setTimeout(() => setSuccessBanner(null), 5000);
    } catch {
      setResetError("Network error occurred while resetting password");
      toast.error("Failed to reset password");
    } finally {
      setIsResetting(false);
    }
  };

  // Handle Toggle Status (Activate / Deactivate)
  const handleConfirmToggle = async () => {
    if (!toggleUser) return;
    setIsToggling(true);

    try {
      const nextStatus = toggleUser.status === "active" ? "inactive" : "active";
      const res = await fetch(`/api/users/${toggleUser._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`User '${toggleUser.name}' marked as ${nextStatus.toUpperCase()}`);
        setSuccessBanner(
          `User '${toggleUser.name}' marked as ${nextStatus.toUpperCase()}.`
        );
        setTimeout(() => setSuccessBanner(null), 5000);
        setReloadTrigger((r) => r + 1);
      } else {
        alert(data.error || "Failed to toggle user status");
        toast.error(data.error || "Failed to toggle user status");
      }
    } catch {
      alert("Network error occurred while toggling status");
      toast.error("Network error updating status");
    } finally {
      setIsToggling(false);
      setToggleUser(null);
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
                User & Role Access Management
              </h1>
              <Badge variant="outline" className="text-xs">
                {users.length} Users
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              SuperAdmin control center for system personnel, branch assignment, password resets, role governance, and session tracking.
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
            <span>Add New User</span>
          </Button>
        </div>

        {/* Success Alert Banner */}
        {successBanner && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="font-medium">{successBanner}</span>
          </div>
        )}

        {/* 5 KPI Metric Cards */}
        <div className="grid gap-3.5 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
          <Card className="glass-card">
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                Total Users
              </span>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="p-3 pt-1">
              <div className="text-2xl font-bold font-mono text-foreground">{totalUsersCount}</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">All accounts</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                Active
              </span>
              <Check className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent className="p-3 pt-1">
              <div className="text-2xl font-bold font-mono text-foreground">{activeCount}</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Permitted access</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                Branch Officers
              </span>
              <Building2 className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent className="p-3 pt-1">
              <div className="text-2xl font-bold font-mono text-foreground">{branchOfficersCount}</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Branch locked</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                Admins
              </span>
              <ShieldCheck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="p-3 pt-1">
              <div className="text-2xl font-bold font-mono text-foreground">{adminOfficersCount}</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Underwriting review</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                Viewers
              </span>
              <Eye className="h-4 w-4 text-sky-500" />
            </CardHeader>
            <CardContent className="p-3 pt-1">
              <div className="text-2xl font-bold font-mono text-foreground">{viewersCount}</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Auditors read-only</p>
            </CardContent>
          </Card>
        </div>

        {/* Role Tabs for Section Governance (All, Branch Officers, Admins, Viewers, SuperAdmins) */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
          {[
            { label: "All Personnel", value: "ALL" },
            { label: "Branch Officers (BRANCH_USER)", value: "BRANCH_USER" },
            { label: "Loan Admins (ADMIN)", value: "ADMIN" },
            { label: "Auditors & Viewers (VIEWER)", value: "VIEWER" },
            { label: "SuperAdmins (SUPERADMIN)", value: "SUPERADMIN" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setRoleFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                roleFilter === tab.value
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter Toolbar */}
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by Name, Email, or Contact Number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full md:w-auto">
                <div className="w-full sm:w-44">
                  <Select
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                    className="h-9 text-xs"
                  >
                    <option value="ALL">All Branches</option>
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="w-full sm:w-36">
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-9 text-xs"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                  </Select>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setReloadTrigger((r) => r + 1)}
                  className="h-9 w-9 text-muted-foreground hover:text-foreground"
                  title="Refresh users"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Directory Table */}
        <Card className="glass-card overflow-hidden">
          <CardHeader className="p-4 border-b border-border/60 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span>Personnel Directory</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Showing {users.length} registered system users • Governance & access management
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4">
                <TableSkeleton rows={8} columns={7} />
              </div>
            ) : users.length === 0 ? (
              <EmptyState
                title="No users match your criteria"
                description={
                  searchTerm || roleFilter !== "ALL" || statusFilter !== "ALL"
                    ? "Try adjusting your search or role filters."
                    : "No users registered yet."
                }
                actionLabel="Create User"
                onAction={() => setIsCreateOpen(true)}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/70 bg-muted/30 text-muted-foreground font-semibold">
                      <th className="py-3 px-4">Officer Name & Contact</th>
                      <th className="py-3 px-4">Permitted Role</th>
                      <th className="py-3 px-4">Assigned Branch</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Last Login</th>
                      <th className="py-3 px-4">Created Date</th>
                      <th className="py-3 px-4 text-right">Governance Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {users.map((u) => {
                      const isSelf = String(currentUser?.id) === String(u._id);

                      return (
                        <tr key={u._id} className="transition-colors hover:bg-accent/40 group">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs uppercase">
                                {u.name.slice(0, 2)}
                              </div>
                              <div>
                                <p className="font-semibold text-foreground flex items-center gap-1.5">
                                  <span>{u.name}</span>
                                  {isSelf && (
                                    <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono">
                                      You
                                    </Badge>
                                  )}
                                </p>
                                <p className="text-[11px] text-muted-foreground">{u.email}</p>
                                {u.phone && (
                                  <p className="text-[10px] text-muted-foreground font-mono">
                                    {u.phone}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={getRoleBadgeVariant(u.role)} className="text-[10px] font-mono">
                              {u.role}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            {u.branchId ? (
                              <div>
                                <p className="font-medium text-foreground">{u.branchId.name}</p>
                                <p className="text-[10px] font-mono text-muted-foreground">
                                  {u.branchId.code}
                                </p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">
                                National / HQ
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={u.status === "active" ? "success" : "secondary"}
                              className="text-[10px] capitalize"
                            >
                              {u.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground font-mono text-[11px]">
                            {u.lastLogin ? (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground/60" />
                                <span>{formatDateTime(u.lastLogin)}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/60">Never</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {formatDate(u.createdAt)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Edit User Button */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditUser(u);
                                  setEditName(u.name);
                                  setEditEmail(u.email);
                                  setEditPhone(u.phone || "");
                                  setEditRole(u.role);
                                  setEditBranchId(u.branchId?._id || "");
                                  setEditStatus(u.status);
                                  setEditError(null);
                                }}
                                className="h-8 gap-1 text-xs"
                                title="Edit user details and roles"
                              >
                                <Edit2 className="h-3.5 w-3.5 text-primary" />
                                <span>Edit</span>
                              </Button>

                              {/* Reset Password Button */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setResetUser(u);
                                  setNewPassword("");
                                  setResetError(null);
                                }}
                                className="h-8 gap-1 text-xs text-indigo-500 hover:text-indigo-600 hover:bg-indigo-500/10"
                                title="Reset user password"
                              >
                                <KeyRound className="h-3.5 w-3.5" />
                                <span>Password</span>
                              </Button>

                              {/* Toggle Status (Active/Inactive) */}
                              {!isSelf && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setToggleUser(u)}
                                  className={`h-8 gap-1 text-xs ${
                                    u.status === "active"
                                      ? "text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                                      : "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                                  }`}
                                  title={u.status === "active" ? "Deactivate account" : "Activate account"}
                                >
                                  <Power className="h-3.5 w-3.5" />
                                  <span>{u.status === "active" ? "Deactivate" : "Activate"}</span>
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* CREATE USER MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsCreateOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span>Create New User Account</span>
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 pt-4">
              {createError && (
                <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-400">
                  {createError}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    required
                    placeholder="E.g. Priya Sharma"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    required
                    type="email"
                    placeholder="user@loanportal.internal"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Phone Contact</label>
                  <Input
                    placeholder="+91 98765 00000"
                    value={createPhone}
                    onChange={(e) => setCreatePhone(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Initial Password (Min 6 Chars) <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    required
                    type="password"
                    placeholder="••••••••"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    className="h-9 text-xs"
                    minLength={6}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Permitted Role <span className="text-rose-500">*</span>
                  </label>
                  <Select
                    value={createRole}
                    onChange={(e) => setCreateRole(e.target.value as UserRole)}
                    className="h-9 text-xs"
                  >
                    <option value="BRANCH_USER">BRANCH_USER (Isolated to branch)</option>
                    <option value="ADMIN">ADMIN (Review across branches)</option>
                    <option value="VIEWER">VIEWER (Read-only observation)</option>
                    <option value="SUPERADMIN">SUPERADMIN (Full governance)</option>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Assigned Branch {createRole === "BRANCH_USER" && <span className="text-rose-500">*</span>}
                  </label>
                  <Select
                    value={createBranchId}
                    onChange={(e) => setCreateBranchId(e.target.value)}
                    className="h-9 text-xs"
                  >
                    <option value="">{createRole === "BRANCH_USER" ? "-- Select Branch (Mandatory) --" : "None (National Headquarters)"}</option>
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Initial Account Status</label>
                <Select
                  value={createStatus}
                  onChange={(e) => setCreateStatus(e.target.value as "active" | "inactive")}
                  className="h-9 text-xs"
                >
                  <option value="active">Active (Permit login)</option>
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
                  <span>Create User</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setEditUser(null)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-primary" />
                <span>Edit User: {editUser.name}</span>
              </h3>
              <button
                onClick={() => setEditUser(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4 pt-4">
              {editError && (
                <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-400">
                  {editError}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Full Name</label>
                  <Input
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Email Address</label>
                  <Input
                    required
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Phone Contact</label>
                  <Input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Account Status</label>
                  <Select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as "active" | "inactive")}
                    className="h-9 text-xs"
                    disabled={String(currentUser?.id) === String(editUser._id)}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Change Permitted Role</label>
                  <Select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="h-9 text-xs"
                    disabled={String(currentUser?.id) === String(editUser._id)}
                  >
                    <option value="BRANCH_USER">BRANCH_USER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="VIEWER">VIEWER</option>
                    <option value="SUPERADMIN">SUPERADMIN</option>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Assign Branch</label>
                  <Select
                    value={editBranchId}
                    onChange={(e) => setEditBranchId(e.target.value)}
                    className="h-9 text-xs"
                  >
                    <option value="">None (National / Head Office)</option>
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditUser(null)}
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

      {/* RESET PASSWORD MODAL */}
      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setResetUser(null)} />
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-indigo-500" />
                <span>Reset Password: {resetUser.name}</span>
              </h3>
              <button
                onClick={() => setResetUser(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4 pt-4">
              <p className="text-xs text-muted-foreground">
                Set a new password for <strong className="text-foreground">{resetUser.email}</strong>. The user will be required to log in with these updated credentials.
              </p>

              {resetError && (
                <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-400">
                  {resetError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  New Password (Minimum 6 Characters) <span className="text-rose-500">*</span>
                </label>
                <Input
                  required
                  type="password"
                  placeholder="Enter new password..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-9 text-xs"
                  minLength={6}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setResetUser(null)}
                  disabled={isResetting}
                  className="text-xs h-9"
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isResetting} className="gap-1.5 text-xs h-9">
                  {isResetting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Reset Password</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM STATUS TOGGLE DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(toggleUser)}
        onClose={() => setToggleUser(null)}
        onConfirm={handleConfirmToggle}
        title={
          toggleUser?.status === "active"
            ? `Deactivate ${toggleUser?.name}?`
            : `Activate ${toggleUser?.name}?`
        }
        description={
          toggleUser?.status === "active"
            ? `Deactivating '${toggleUser?.name}' (${toggleUser?.email}) will revoke their authentication access immediately. Their session will be terminated upon token expiration.`
            : `Activating '${toggleUser?.name}' (${toggleUser?.email}) will re-enable login and role permissions.`
        }
        confirmLabel={toggleUser?.status === "active" ? "Deactivate User" : "Activate User"}
        variant={toggleUser?.status === "active" ? "destructive" : "default"}
        isLoading={isToggling}
      />
    </DashboardShell>
  );
}
