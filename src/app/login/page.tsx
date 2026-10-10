"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Layers,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { toast } from "@/components/ui/toaster";
import { useAuth } from "@/context/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/";
  const { setUser, refreshSession } = useAuth();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");

  const demoAccounts = [
    {
      role: "SUPERADMIN",
      email: "superadmin@loanportal.internal",
      password: "SuperAdmin@2026!",
      label: "SuperAdmin",
      desc: "Full System Access & Branches",
      badgeVariant: "purple" as const,
    },
    {
      role: "ADMIN",
      email: "admin@loanportal.internal",
      password: "Admin@2026!",
      label: "Loan Admin",
      desc: "National Review & Status Updates",
      badgeVariant: "default" as const,
    },
    {
      role: "BRANCH_USER",
      email: "delhi.branch@loanportal.internal",
      password: "Branch@2026!",
      label: "Delhi Branch",
      desc: "Isolated Branch Applications",
      badgeVariant: "info" as const,
    },
    {
      role: "VIEWER",
      email: "viewer@loanportal.internal",
      password: "Viewer@2026!",
      label: "Auditor / Viewer",
      desc: "Read-Only Overview",
      badgeVariant: "secondary" as const,
    },
  ];

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage("");

    if (!email || !password) {
      setErrorMessage("Please enter both email and password");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Authentication failed");
        setIsLoading(false);
        return;
      }

      // Immediately sync state into React AuthContext
      if (data?.user) {
        setUser(data.user);
      }
      await refreshSession();

      // Successful login
      toast.success("Authentication successful! Redirecting...");
      router.push(redirectPath);
      router.refresh();
    } catch {
      setErrorMessage("Network error connecting to login service. Please retry.");
      toast.error("Network error connecting to server");
      setIsLoading(false);
    }
  };

  const fillCredentials = (acct: (typeof demoAccounts)[0]) => {
    setEmail(acct.email);
    setPassword(acct.password);
    setErrorMessage("");
    toast.info(`Loaded demo credentials for ${acct.label}`);
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 bg-background selection:bg-primary/20 overflow-hidden">
      {/* Subtle Ambient Mesh Glow Accents */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-40 dark:opacity-20">
        <div className="absolute left-1/4 top-1/4 h-[550px] w-[550px] rounded-full bg-gradient-to-br from-primary/30 to-indigo-500/0 blur-3xl animate-pulse" />
        <div className="absolute right-1/4 bottom-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-tl from-blue-500/20 to-sky-400/0 blur-3xl" />
      </div>

      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle className="h-9 w-9" />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 text-white shadow-lg shadow-primary/25 mb-1">
            <Layers className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Loan Management Portal
          </h1>
          <p className="text-xs text-muted-foreground">
            Sign in to access secure multi-branch loan processing operations
          </p>
        </div>

        {/* Login Form Card */}
        <div className="glass-card p-6 md:p-8 space-y-5 border border-border/80 shadow-2xl backdrop-blur-2xl">
          {errorMessage && (
            <div className="flex items-center gap-2.5 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in-50">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                Email Address
              </label>
              <Input
                type="email"
                placeholder="name@loanportal.internal"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                Password
              </label>
              <Input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              variant="gradient"
              className="w-full gap-2 shadow-md hover:shadow-lg transition-all"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Demo Accounts Quick-Fill Section */}
          <div className="border-t border-border/60 pt-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <KeyRound className="h-3 w-3" />
                Instant Role Quick-Fill
              </p>
              <span className="text-[10px] text-muted-foreground">Click to populate</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((acct) => (
                <button
                  key={acct.role}
                  type="button"
                  onClick={() => fillCredentials(acct)}
                  className="flex flex-col text-left p-2.5 rounded-lg border border-border/60 bg-accent/20 hover:bg-accent/60 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                      {acct.label}
                    </span>
                    <Badge variant={acct.badgeVariant} className="text-[9px] py-0 px-1">
                      {acct.role.slice(0, 5)}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate leading-tight">
                    {acct.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Security Footer Notice */}
        <div className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Server-Side RBAC & Audit Logging Active</span>
        </div>
      </div>
    </div>
  );
}
