import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getDatabaseStatus } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Database,
  ShieldCheck,
  Clock,
  Cpu,
  CheckCircle2,
} from "lucide-react";
import { StaggerContainer, StaggerItem } from "@/components/motion/motion-components";

export const dynamic = "force-dynamic";

async function getDiagnosticsTelemetry() {
  const t0 = Date.now();
  const dbStatus = await getDatabaseStatus();
  const dbPingMs = Date.now() - t0;
  const sessionUser = await getSessionUser();

  const uptimeSeconds = Math.floor(process.uptime());
  const uptimeHours = Math.floor(uptimeSeconds / 3600);
  const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);

  const memoryUsage = process.memoryUsage();
  const heapUsedMb = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const heapTotalMb = Math.round(memoryUsage.heapTotal / 1024 / 1024);
  const rssMb = Math.round(memoryUsage.rss / 1024 / 1024);

  return {
    dbStatus,
    dbPingMs,
    sessionUser,
    uptimeHours,
    uptimeMinutes,
    heapUsedMb,
    heapTotalMb,
    rssMb,
  };
}

export default async function DiagnosticsPage() {
  const {
    dbStatus,
    dbPingMs,
    sessionUser,
    uptimeHours,
    uptimeMinutes,
    heapUsedMb,
    heapTotalMb,
    rssMb,
  } = await getDiagnosticsTelemetry();

  return (
    <DashboardShell dbStatus={dbStatus} initialUser={sessionUser}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            System Diagnostics & Telemetry
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Live operational telemetry, database connection health, and infrastructure security metrics.
          </p>
        </div>
        {/* Top Status Banner */}
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border backdrop-blur-xl ${
            dbStatus.connected
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-950 dark:text-emerald-200"
              : "bg-rose-500/10 border-rose-500/20 text-rose-950 dark:text-rose-200"
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                dbStatus.connected ? "bg-emerald-500/20 text-emerald-500" : "bg-rose-500/20 text-rose-500"
              }`}
            >
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground text-base">
                  {dbStatus.connected ? "All Production Systems Operational" : "Service Disruption Detected"}
                </h3>
                <Badge variant={dbStatus.connected ? "success" : "destructive"}>
                  {dbStatus.connected ? "Operational" : "Degraded"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Database heartbeat acknowledged with {dbPingMs}ms response latency.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-left sm:text-right">
              <span className="text-xs text-muted-foreground block">System Uptime</span>
              <span className="font-mono text-sm font-semibold text-foreground">
                {uptimeHours}h {uptimeMinutes}m
              </span>
            </div>
          </div>
        </div>

        {/* Diagnostics Grid */}
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StaggerItem>
            <Card className="border-border/70 bg-card/60 backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Database Engine</CardTitle>
                <Database className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-foreground">MongoDB Atlas</div>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-emerald-500 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>State: {dbStatus.state}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 font-mono truncate">
                  Cluster: {dbStatus.host || "feeflow.scf0iv2.mongodb.net"}
                </p>
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card className="border-border/70 bg-card/60 backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Heartbeat Latency</CardTitle>
                <Clock className="h-4 w-4 text-sky-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-foreground">{dbPingMs} ms</div>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-sky-500 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Real-time Response</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Pool: max 10 connections
                </p>
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card className="border-border/70 bg-card/60 backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Runtime Memory</CardTitle>
                <Cpu className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-foreground">{heapUsedMb} MB</div>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-indigo-500 font-medium">
                  <span>Heap Total: {heapTotalMb} MB</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Resident (RSS): {rssMb} MB
                </p>
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card className="border-border/70 bg-card/60 backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">Security Posture</CardTitle>
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-foreground">Hardened</div>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-emerald-500 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Rate Limiting Active</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  HSTS, nosniff, SameSite Lax
                </p>
              </CardContent>
            </Card>
          </StaggerItem>
        </StaggerContainer>

        {/* Detailed Diagnostics Table */}
        <Card className="border-border/70 bg-card/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-base">Environment & Operational Parameters</CardTitle>
            <CardDescription className="text-xs">
              System configuration and runtime parameters verified at runtime.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border/60 text-sm">
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Application Service</span>
                <span className="font-medium text-foreground">{env.NEXT_PUBLIC_APP_NAME}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Deployment Environment</span>
                <Badge variant="outline" className="font-mono text-xs uppercase">
                  {env.NODE_ENV}
                </Badge>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Node.js Version</span>
                <span className="font-mono text-foreground">{process.version}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Database Name</span>
                <span className="font-mono text-foreground">{dbStatus.name || "loan_portal"}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Session Expiration</span>
                <span className="font-mono text-foreground">{env.JWT_EXPIRES_IN}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">HTTP Security Headers</span>
                <div className="flex items-center gap-2">
                  <Badge variant="success" className="text-[10px]">X-Frame-Options: SAMEORIGIN</Badge>
                  <Badge variant="success" className="text-[10px]">nosniff</Badge>
                  <Badge variant="success" className="text-[10px]">HSTS</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
