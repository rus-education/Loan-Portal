"use client";

import * as React from "react";
import {
  Database,
  Shield,
  CheckCircle2,
  IndianRupee,
  RefreshCw,
  Power,
  Layers,
  Sparkles,
  Server,
  Lock,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardSkeletonGrid } from "@/components/feedback/table-skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toaster";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api-client";

interface SystemSettingsData {
  appName: string;
  version: string;
  environment: string;
  database: {
    connected: boolean;
    host?: string;
    databaseName?: string;
    state?: string;
  };
  counts: {
    branches: number;
    users: number;
    loans: number;
    auditLogs: number;
  };
  policies: {
    sessionExpiry: string;
    defaultCurrency: string;
    minLoanAmount: number;
    maxLoanAmount: number;
    allowCrossBranchAuditing: boolean;
    maintenanceMode: boolean;
  };
}

export default function SystemSettingsPage() {
  const { user: currentUser, isLoading: isAuthLoading } = useAuth();
  const [settings, setSettings] = React.useState<SystemSettingsData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [successBanner, setSuccessBanner] = React.useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = React.useState(0);

  // Maintenance mode confirmation
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = React.useState(false);
  const [maintenanceState, setMaintenanceState] = React.useState(false);

  // Fetch system settings
  React.useEffect(() => {
    if (isAuthLoading) return;
    if (!currentUser || currentUser.role !== "SUPERADMIN") {
      setIsLoading(false);
      return;
    }

    let ignore = false;
    async function load() {
      try {
        const res = await apiFetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          if (!ignore && data.success) {
            setSettings(data.data);
            setMaintenanceState(data.data.policies.maintenanceMode);
          }
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
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
  }, [currentUser, isAuthLoading, reloadTrigger]);

  // Handle Maintenance Toggle
  const handleToggleMaintenance = async () => {
    setIsSaving(true);
    try {
      const nextState = !maintenanceState;
      const res = await apiFetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maintenanceMode: nextState }),
      });

      if (res.ok) {
        setMaintenanceState(nextState);
        toast.success(
          `Maintenance mode has been ${nextState ? "ACTIVATED" : "DEACTIVATED"}`
        );
        setSuccessBanner(
          `Maintenance mode has been ${nextState ? "ACTIVATED" : "DEACTIVATED"}.`
        );
        setTimeout(() => setSuccessBanner(null), 5000);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update maintenance setting");
      }
    } catch {
      toast.error("Network error updating maintenance setting");
    } finally {
      setIsSaving(false);
      setIsMaintenanceModalOpen(false);
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
                System Settings & Platform Governance
              </h1>
              <Badge variant="purple" className="text-xs gap-1">
                <Sparkles className="h-3 w-3" />
                SuperAdmin Master Console
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Global configuration, MongoDB Atlas connection cluster parameters, financial limits, and operational maintenance controls.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsLoading(true);
              setReloadTrigger((r) => r + 1);
              toast.info("Refreshed cluster diagnostics");
            }}
            className="gap-2 h-9 self-start sm:self-auto"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh Diagnostics</span>
          </Button>
        </div>

        {/* Success Alert Banner */}
        {successBanner && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="font-medium">{successBanner}</span>
          </div>
        )}

        {isLoading || !settings ? (
          <div className="space-y-6">
            <CardSkeletonGrid count={4} />
            <div className="rounded-2xl border border-border/60 bg-card/40 p-6 space-y-4">
              <div className="h-4 w-48 rounded bg-muted/60 animate-shimmer" />
              <div className="h-32 rounded-xl bg-muted/30 animate-shimmer" />
            </div>
          </div>
        ) : (
          <>
            {/* 4 Health & Environment Diagnostic Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="glass-card">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Database Cluster
                  </CardTitle>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                    <Database className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xl font-bold text-foreground font-mono">
                      {settings.database.connected ? "Connected" : "Disconnected"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 truncate">
                    Atlas DB: {settings.database.databaseName || "loan_portal"}
                  </p>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Software Build
                  </CardTitle>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Server className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-foreground font-mono truncate">
                    {settings.version}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 capitalize">
                    Node Environment: {settings.environment}
                  </p>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Regional Network
                  </CardTitle>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                    <Layers className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-foreground font-mono">
                    {settings.counts.branches} Branches
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {settings.counts.users} Registered Personnel
                  </p>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Security & RBAC
                  </CardTitle>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
                    <Shield className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-foreground font-mono">
                    Strict RBAC
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {settings.counts.auditLogs} Audit Events Recorded
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Detailed System Configuration Sections */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Security & Access Policies */}
              <Card className="glass-card">
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <Lock className="h-4 w-4 text-primary" />
                    <span>Security & Authentication Governance</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Cryptographic tokens, session lifespans, and access control policies
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-3 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Session Expiration:</span>
                    <span className="font-mono font-semibold text-foreground">
                      {settings.policies.sessionExpiry} (HTTP-only JWT)
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Hashing Algorithm:</span>
                    <span className="font-mono font-semibold text-foreground">
                      bcryptjs (Salt rounds: 12)
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Cross-Branch Auditing:</span>
                    <Badge variant="success" className="text-[10px]">
                      Enabled (SuperAdmin & Admin)
                    </Badge>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Branch User Isolation:</span>
                    <Badge variant="info" className="text-[10px]">
                      Enforced (Strict IDOR Protected)
                    </Badge>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Audit Log Persistence:</span>
                    <span className="font-semibold text-foreground">Permanent Immutable DB Collection</span>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Origination Parameters */}
              <Card className="glass-card">
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <IndianRupee className="h-4 w-4 text-emerald-500" />
                    <span>Financial Parameters & Application Rules</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Loan sanction thresholds, accepted currencies, and intake cycles
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-3 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Default Currency:</span>
                    <span className="font-semibold text-foreground font-mono">
                      {settings.policies.defaultCurrency}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Minimum Loan Amount:</span>
                    <span className="font-mono font-bold text-foreground">₹50,000</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Maximum Sanction Ceiling:</span>
                    <span className="font-mono font-bold text-foreground">₹2,00,00,000 (2 Crores)</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Intake Calendar Range:</span>
                    <span className="text-foreground">2024 to 2028 (Monthly intakes)</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Total Sanctioned Portfolio:</span>
                    <span className="font-mono font-bold text-primary">
                      {settings.counts.loans} Registered Applications
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Maintenance & Administrative Operations */}
            <Card className="glass-card border-border/80">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Power className="h-4 w-4 text-amber-500" />
                  <span>Administrative Maintenance & System Safety Controls</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Controls for portal availability and system-wide operational maintenance
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-semibold text-foreground">Portal Maintenance Mode</h4>
                    <Badge variant={maintenanceState ? "destructive" : "success"} className="text-[10px]">
                      {maintenanceState ? "Maintenance Active" : "Operational (Normal)"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-xl">
                    When active, branch users and viewers will see a system maintenance banner. SuperAdmins retain full management access.
                  </p>
                </div>

                <Button
                  variant={maintenanceState ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsMaintenanceModalOpen(true)}
                  disabled={isSaving}
                  className="gap-2 shrink-0 text-xs h-9"
                >
                  <Power className="h-3.5 w-3.5" />
                  <span>{maintenanceState ? "Disable Maintenance Mode" : "Enable Maintenance Mode"}</span>
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* CONFIRM MAINTENANCE DIALOG */}
      <ConfirmDialog
        isOpen={isMaintenanceModalOpen}
        onClose={() => setIsMaintenanceModalOpen(false)}
        onConfirm={handleToggleMaintenance}
        title={maintenanceState ? "Disable Maintenance Mode?" : "Activate Maintenance Mode?"}
        description={
          maintenanceState
            ? "Disabling maintenance mode will restore standard operational access for all branch users, applicants, and viewers."
            : "Activating maintenance mode will notify all active sessions that system maintenance is underway."
        }
        confirmLabel={maintenanceState ? "Restore Operations" : "Activate Maintenance"}
        variant={maintenanceState ? "default" : "warning"}
        isLoading={isSaving}
      />
    </DashboardShell>
  );
}
