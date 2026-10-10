"use client";

import * as React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { PageTransition } from "@/components/motion/motion-components";
import { useAuth } from "@/context/auth-context";
import type { UserRole, UserSession } from "@/types";

interface DashboardShellProps {
  children: React.ReactNode;
  initialRole?: UserRole;
  initialUser?: UserSession | null;
  dbStatus?: {
    connected: boolean;
    state: string;
  };
}

export function DashboardShell({
  children,
  initialRole,
  initialUser,
  dbStatus = { connected: true, state: "connected" },
}: DashboardShellProps) {
  const { user: authUser } = useAuth();
  const effectiveUser = initialUser || authUser;

  const [role, setRole] = React.useState<UserRole>(
    effectiveUser?.role || initialRole || "SUPERADMIN"
  );
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = React.useState(false);

  React.useEffect(() => {
    if (effectiveUser?.role) {
      setRole(effectiveUser.role);
    }
  }, [effectiveUser?.role]);

  const currentUser = {
    name: effectiveUser?.name || "System User",
    email: effectiveUser?.email || "user@loanportal.internal",
    role: effectiveUser?.role || role,
    branchName: effectiveUser?.branchName || undefined,
  };

  return (
    <div className="relative flex min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      {/* Subtle Ambient Mesh Glow Accents */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-30 dark:opacity-20">
        <div className="absolute -left-[10%] -top-[10%] h-[500px] w-[500px] rounded-full bg-gradient-to-br from-primary/30 to-indigo-500/0 blur-3xl" />
        <div className="absolute -right-[10%] top-[40%] h-[600px] w-[600px] rounded-full bg-gradient-to-bl from-blue-500/20 to-sky-400/0 blur-3xl" />
      </div>

      {/* Desktop Sidebar */}
      <Sidebar
        currentRole={role}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        className="hidden md:flex relative z-20"
      />

      {/* Mobile Drawer */}
      <MobileNav
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        currentRole={role}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden relative z-10">
        <Topbar
          onOpenMobileNav={() => setIsMobileNavOpen(true)}
          currentUser={currentUser}
          onRoleChange={(newRole) => setRole(newRole)}
          dbStatus={dbStatus}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>
      </div>
    </div>
  );
}
