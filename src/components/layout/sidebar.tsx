"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  Building,
  Users,
  ShieldAlert,
  Activity,
  Layers,
  Settings,
  ChevronLeft,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

interface SidebarProps {
  currentRole?: UserRole;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

interface NavItemConfig {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
  badge?: string;
}

const NAV_ITEMS: NavItemConfig[] = [
  {
    title: "Overview",
    href: "/",
    icon: LayoutDashboard,
    roles: ["SUPERADMIN", "ADMIN", "BRANCH_USER", "VIEWER"],
  },
  {
    title: "Loan Records",
    href: "/loans",
    icon: FileText,
    roles: ["SUPERADMIN", "ADMIN", "BRANCH_USER", "VIEWER"],
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    roles: ["SUPERADMIN", "ADMIN"],
    badge: "BI",
  },
  {
    title: "New Request",
    href: "/loans/new",
    icon: PlusCircle,
    roles: ["SUPERADMIN", "BRANCH_USER"],
    badge: "Create",
  },
  {
    title: "Branches (21+)",
    href: "/branches",
    icon: Building,
    roles: ["SUPERADMIN"],
  },
  {
    title: "User Management",
    href: "/users",
    icon: Users,
    roles: ["SUPERADMIN"],
  },
  {
    title: "Audit Logs",
    href: "/audit-logs",
    icon: ShieldAlert,
    roles: ["SUPERADMIN", "ADMIN"],
  },
  {
    title: "System Settings",
    href: "/settings",
    icon: Settings,
    roles: ["SUPERADMIN"],
  },
  {
    title: "System Diagnostics",
    href: "/diagnostics",
    icon: Activity,
    roles: ["SUPERADMIN", "ADMIN", "BRANCH_USER", "VIEWER"],
  },
];

export function Sidebar({
  currentRole = "SUPERADMIN",
  isCollapsed = false,
  onToggleCollapse,
  className,
}: SidebarProps) {
  const pathname = usePathname();

  const filteredItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(currentRole)
  );

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r border-border/80 bg-card/60 backdrop-blur-xl transition-all duration-300 select-none z-30",
        isCollapsed ? "w-18" : "w-64",
        className
      )}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-border/60">
        <Link href="/" className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-indigo-600 text-white shadow-md shadow-primary/20">
            <Layers className="h-5 w-5" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-foreground leading-none">
                LOAN PORTAL
              </span>
              <span className="text-[10px] text-muted-foreground font-medium mt-1 uppercase tracking-wider">
                Enterprise v1.0
              </span>
            </div>
          )}
        </Link>
        {onToggleCollapse && !isCollapsed && (
          <button
            onClick={onToggleCollapse}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {!isCollapsed && (
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">
            Navigation
          </p>
        )}
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-all duration-150",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 font-semibold"
                  : "text-muted-foreground hover:bg-accent/70 hover:text-foreground hover:translate-x-0.5",
                isCollapsed && "justify-center px-2 hover:translate-x-0"
              )}
              title={isCollapsed ? item.title : undefined}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-110",
                  isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              {!isCollapsed && (
                <span className="truncate flex-1">{item.title}</span>
              )}
              {!isCollapsed && item.badge && (
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-primary/10 text-primary"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Collapse Toggle when collapsed */}
      {onToggleCollapse && isCollapsed && (
        <div className="p-3 border-t border-border/60 flex justify-center">
          <button
            onClick={onToggleCollapse}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </aside>
  );
}
