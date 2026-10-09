"use client";

import * as React from "react";
import { Menu, Database, CheckCircle2, XCircle } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@/types";

interface TopbarProps {
  onOpenMobileNav: () => void;
  currentUser?: {
    name: string;
    email: string;
    role: UserRole;
    branchName?: string;
  };
  onRoleChange?: (role: UserRole) => void;
  dbStatus?: {
    connected: boolean;
    state: string;
  };
}

export function Topbar({
  onOpenMobileNav,
  currentUser,
  onRoleChange,
  dbStatus = { connected: true, state: "connected" },
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-border/80 bg-background/80 px-4 md:px-6 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={onOpenMobileNav}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
          aria-label="Open mobile navigation"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Brand / Title for Mobile */}
        <div className="flex items-center gap-2 md:hidden">
          <span className="text-sm font-bold tracking-tight text-foreground">LOAN PORTAL</span>
        </div>

        {/* Database & Environment Status Badge (Desktop) */}
        <div className="hidden items-center gap-2 sm:flex">
          <div
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors ${
              dbStatus.connected
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
            }`}
            title={`Database: ${dbStatus.state}`}
          >
            <Database className="h-3 w-3" />
            <span className="font-mono">MongoDB:</span>
            <span>{dbStatus.connected ? "Online" : "Connecting"}</span>
            {dbStatus.connected ? (
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            ) : (
              <XCircle className="h-3 w-3 text-amber-500 animate-pulse" />
            )}
          </div>

          <Badge variant="outline" className="text-[10px] hidden lg:inline-flex text-muted-foreground">
            Server-side RBAC
          </Badge>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Live Theme Toggle */}
        <ThemeToggle className="h-9 w-9 rounded-lg" />

        <div className="h-4 w-[1px] bg-border/80" />

        {/* User Profile Menu with Role Switcher */}
        <UserMenu
          user={currentUser}
          onRoleChange={onRoleChange}
        />
      </div>
    </header>
  );
}
