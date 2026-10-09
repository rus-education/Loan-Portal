"use client";

import * as React from "react";
import {
  ShieldAlert,
  RefreshCw,
  Activity,
  Layers,
  Building,
  KeyRound,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/feedback/empty-state";
import { TableSkeleton } from "@/components/feedback/table-skeleton";
import { toast } from "@/components/ui/toaster";
import { formatDateTime } from "@/lib/utils";
import type { UserSession } from "@/types";

interface AuditLogItem {
  _id: string;
  userId?: {
    _id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ip?: string;
  userAgent?: string;
  timestamp: string;
}

const ACTION_OPTIONS = [
  { label: "All Audit Actions", value: "" },
  { label: "User Login (USER_LOGIN)", value: "USER_LOGIN" },
  { label: "Failed Login (LOGIN_FAILED)", value: "LOGIN_FAILED" },
  { label: "Loan Created (LOAN_APPLICATION_CREATED)", value: "LOAN_APPLICATION_CREATED" },
  { label: "Loan Updated (LOAN_APPLICATION_UPDATED)", value: "LOAN_APPLICATION_UPDATED" },
  { label: "Loan Deleted (LOAN_APPLICATION_DELETED)", value: "LOAN_APPLICATION_DELETED" },
  { label: "User Created (USER_CREATED)", value: "USER_CREATED" },
  { label: "User Updated (USER_UPDATED)", value: "USER_UPDATED" },
  { label: "User Status Changed (USER_STATUS_CHANGED)", value: "USER_STATUS_CHANGED" },
  { label: "Role Changed (ROLE_CHANGED)", value: "ROLE_CHANGED" },
  { label: "Password Reset (PASSWORD_RESET)", value: "PASSWORD_RESET" },
  { label: "Branch Created (BRANCH_CREATED)", value: "BRANCH_CREATED" },
  { label: "Branch Updated (BRANCH_UPDATED)", value: "BRANCH_UPDATED" },
  { label: "Branch Status Changed (BRANCH_STATUS_CHANGED)", value: "BRANCH_STATUS_CHANGED" },
  { label: "System Settings Updated (SYSTEM_SETTINGS_UPDATED)", value: "SYSTEM_SETTINGS_UPDATED" },
];

const ENTITY_OPTIONS = [
  { label: "All Entities", value: "" },
  { label: "LoanApplication", value: "LoanApplication" },
  { label: "User", value: "User" },
  { label: "Branch", value: "Branch" },
  { label: "Auth", value: "Auth" },
  { label: "System", value: "System" },
];

export default function AuditLogsPage() {
  const [currentUser, setCurrentUser] = React.useState<UserSession | null>(null);
  const [logs, setLogs] = React.useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Filters state with lazy initialization
  const [actionFilter, setActionFilter] = React.useState("");
  const [entityFilter, setEntityFilter] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(20);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);
  const [reloadTrigger, setReloadTrigger] = React.useState(0);

  // Inspect Diff Modal
  const [inspectItem, setInspectItem] = React.useState<AuditLogItem | null>(null);

  // 1. Fetch current session
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

  // 2. Fetch audit logs
  React.useEffect(() => {
    let ignore = false;
    async function load() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        if (actionFilter) params.set("action", actionFilter);
        if (entityFilter) params.set("entity", entityFilter);

        const res = await fetch(`/api/audit-logs?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (!ignore && data.success) {
            setLogs(data.data || []);
            setTotalPages(data.pagination?.totalPages || 1);
            setTotalCount(data.pagination?.total || 0);
          }
        }
      } catch (err) {
        console.error("Failed to fetch audit logs:", err);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [page, limit, actionFilter, entityFilter, reloadTrigger]);

  const getActionBadgeVariant = (action: string) => {
    if (action.includes("LOGIN") || action.includes("AUTH")) return "info" as const;
    if (action.includes("LOAN")) return "success" as const;
    if (action.includes("USER") || action.includes("ROLE")) return "purple" as const;
    if (action.includes("BRANCH")) return "warning" as const;
    if (action.includes("DELETE") || action.includes("FAILED")) return "destructive" as const;
    return "secondary" as const;
  };

  return (
    <DashboardShell initialUser={currentUser}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                System Audit Logs & Security Trails
              </h1>
              <Badge variant="outline" className="text-xs">
                {totalCount} Total Events
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Immutable chronological record of logins, workflow progressions, loan modifications, user creation, and branch management events.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setReloadTrigger((r) => r + 1)}
            className="gap-2 self-start sm:self-auto h-9"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh Logs</span>
          </Button>
        </div>

        {/* 4 Category Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="glass-card">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Audit Events
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Activity className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground font-mono">{totalCount}</div>
              <p className="text-[11px] text-muted-foreground mt-1">Logged operational events</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Auth & Access
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
                <KeyRound className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground font-mono">
                {logs.filter((l) => l.entity === "Auth").length}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Session events on current page</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Loan Operations
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                <Layers className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground font-mono">
                {logs.filter((l) => l.entity === "LoanApplication").length}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Application submissions & updates</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Governance Changes
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <Building className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground font-mono">
                {logs.filter((l) => l.entity === "User" || l.entity === "Branch" || l.entity === "System").length}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Personnel & branch changes</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters Bar */}
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground mb-1 block uppercase">
                  Audit Action Filter
                </label>
                <Select
                  value={actionFilter}
                  onChange={(e) => {
                    setActionFilter(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 text-xs"
                >
                  {ACTION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-muted-foreground mb-1 block uppercase">
                  Target Entity
                </label>
                <Select
                  value={entityFilter}
                  onChange={(e) => {
                    setEntityFilter(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 text-xs"
                >
                  {ENTITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex items-end gap-2">
                {(actionFilter || entityFilter) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActionFilter("");
                      setEntityFilter("");
                      setPage(1);
                      toast.success("Audit filters reset");
                    }}
                    className="h-9 text-xs gap-1.5"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Clear Filters</span>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Audit Logs Table */}
        <Card className="glass-card overflow-hidden">
          <CardHeader className="p-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-primary" />
                <span>Audit Trail Records</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Showing {logs.length} of {totalCount} chronological security entries
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Rows per page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="h-7 rounded border border-border/80 bg-background/50 px-2 text-xs text-foreground focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4">
                <TableSkeleton rows={8} columns={6} />
              </div>
            ) : logs.length === 0 ? (
              <EmptyState
                title="No audit events found"
                description={
                  actionFilter || entityFilter
                    ? "No audit records match your selected filter criteria."
                    : "No audit events logged yet."
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/70 bg-muted/30 text-muted-foreground font-semibold">
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Action Event</th>
                      <th className="py-3 px-4">Target Entity</th>
                      <th className="py-3 px-4">Authorized User / Actor</th>
                      <th className="py-3 px-4">Network IP / Client</th>
                      <th className="py-3 px-4 text-right">Payload Diff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {logs.map((log) => (
                      <tr key={log._id} className="transition-colors hover:bg-accent/40 group">
                        <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                          {formatDateTime(log.timestamp)}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={getActionBadgeVariant(log.action)} className="text-[10px] font-mono">
                            {log.action}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-foreground">{log.entity}</span>
                          {log.entityId && (
                            <span className="block font-mono text-[10px] text-muted-foreground truncate max-w-[120px]">
                              {log.entityId}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {log.userId ? (
                            <div>
                              <p className="font-medium text-foreground">{log.userId.name}</p>
                              <p className="text-[10px] text-muted-foreground">{log.userId.email}</p>
                              <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono mt-0.5">
                                {log.userId.role}
                              </Badge>
                            </div>
                          ) : (
                            <span className="italic text-muted-foreground text-[11px]">System / Anonymous</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-[10px] text-muted-foreground">
                          <div>{log.ip || "127.0.0.1"}</div>
                          {log.userAgent && (
                            <div className="truncate max-w-[140px] text-muted-foreground/60" title={log.userAgent}>
                              {log.userAgent}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {(log.oldValue || log.newValue) ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setInspectItem(log)}
                              className="h-8 gap-1 text-xs text-primary"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>Inspect</span>
                            </Button>
                          ) : (
                            <span className="text-muted-foreground/50 text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {!isLoading && totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border/60 p-4 gap-3">
                <span className="text-xs text-muted-foreground">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalCount)} of {totalCount} audit entries (Page {page} of {totalPages})
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="h-8 px-2.5 gap-1 text-xs"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>Previous</span>
                  </Button>
                  <span className="text-xs font-mono px-2 text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="h-8 px-2.5 gap-1 text-xs"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* INSPECT DIFF MODAL */}
      {inspectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setInspectItem(null)} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>Audit Payload Inspection: {inspectItem.action}</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  Entity: {inspectItem.entity} • ID: {inspectItem.entityId || "N/A"} • {formatDateTime(inspectItem.timestamp)}
                </p>
              </div>
              <button
                onClick={() => setInspectItem(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-4 space-y-4 overflow-y-auto flex-1 text-xs">
              {Boolean(inspectItem.oldValue) && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-rose-500 uppercase text-[10px]">
                      Previous State (Old Value):
                    </span>
                  </div>
                  <pre className="p-3 rounded-xl bg-muted/40 border border-border/60 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap text-foreground">
                    {JSON.stringify(inspectItem.oldValue, null, 2)}
                  </pre>
                </div>
              )}

              {Boolean(inspectItem.newValue) && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-500 uppercase text-[10px]">
                      Updated State (New Value):
                    </span>
                  </div>
                  <pre className="p-3 rounded-xl bg-muted/40 border border-border/60 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap text-foreground">
                    {JSON.stringify(inspectItem.newValue, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-border/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInspectItem(null)}
                className="text-xs h-8"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
