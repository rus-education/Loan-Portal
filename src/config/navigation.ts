import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  Building,
  Users,
  ShieldAlert,
  Activity,
  BarChart3,
  Settings,
} from "lucide-react";
import type { UserRole } from "@/types";

export interface NavItemConfig {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: readonly UserRole[];
  badge?: string;
  description?: string;
}

export const ALL_ROLES: readonly UserRole[] = [
  "SUPERADMIN",
  "ADMIN",
  "BRANCH_USER",
  "VIEWER",
] as const;

export const NAV_ITEMS: readonly NavItemConfig[] = [
  {
    title: "Overview",
    href: "/",
    icon: LayoutDashboard,
    roles: ALL_ROLES,
    description: "Executive and operational summary dashboard",
  },
  {
    title: "Loan Records",
    href: "/loans",
    icon: FileText,
    roles: ALL_ROLES,
    description: "Search, filter, and review student loan records",
  },
  {
    title: "New Application",
    href: "/loans/new",
    icon: PlusCircle,
    roles: ["SUPERADMIN", "BRANCH_USER"],
    badge: "Create",
    description: "Submit new student loan file for branch",
  },
  {
    title: "Executive Analytics",
    href: "/analytics",
    icon: BarChart3,
    roles: ["SUPERADMIN", "ADMIN"],
    badge: "BI",
    description: "National financial and branch intake metrics",
  },
  {
    title: "Branch Governance",
    href: "/branches",
    icon: Building,
    roles: ["SUPERADMIN"],
    description: "Manage national branches and office operations",
  },
  {
    title: "User Management",
    href: "/users",
    icon: Users,
    roles: ["SUPERADMIN"],
    description: "Govern users, branch assignments, and credentials",
  },
  {
    title: "Audit & Security Logs",
    href: "/audit-logs",
    icon: ShieldAlert,
    roles: ["SUPERADMIN", "ADMIN"],
    description: "Immutable chronological compliance trails",
  },
  {
    title: "System Settings",
    href: "/settings",
    icon: Settings,
    roles: ["SUPERADMIN"],
    description: "Platform security and system configurations",
  },
  {
    title: "System Diagnostics",
    href: "/diagnostics",
    icon: Activity,
    roles: ALL_ROLES,
    description: "Health checks, database connectivity, and uptime",
  },
] as const;

/**
 * Filter navigation items strictly for the authenticated user's role.
 * If role is not yet resolved, returns an empty array or safe base items.
 */
export function getNavItemsForRole(role: UserRole | null | undefined): NavItemConfig[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

/**
 * Check if a route path is permitted for a given user role.
 */
export function isPathPermittedForRole(pathname: string, role: UserRole | null | undefined): boolean {
  if (!role) return false;

  // Normalize path
  const normalizedPath = pathname.split("?")[0].replace(/\/$/, "") || "/";

  // Check exact matches first
  const exactMatch = NAV_ITEMS.find((item) => item.href === normalizedPath);
  if (exactMatch) {
    return exactMatch.roles.includes(role);
  }

  // Nested routes check
  if (normalizedPath.startsWith("/loans/")) {
    if (normalizedPath === "/loans/new") {
      return role === "SUPERADMIN" || role === "BRANCH_USER";
    }
    // Loan details (/loans/[id])
    return true; // Controlled by IDOR in API / Page
  }

  if (normalizedPath.startsWith("/branches")) {
    return role === "SUPERADMIN";
  }

  if (normalizedPath.startsWith("/users")) {
    return role === "SUPERADMIN";
  }

  if (normalizedPath.startsWith("/settings")) {
    return role === "SUPERADMIN";
  }

  if (normalizedPath.startsWith("/analytics")) {
    return role === "SUPERADMIN" || role === "ADMIN";
  }

  if (normalizedPath.startsWith("/audit-logs")) {
    return role === "SUPERADMIN" || role === "ADMIN";
  }

  return true;
}
