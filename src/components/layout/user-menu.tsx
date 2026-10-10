"use client";

import * as React from "react";
import { ShieldCheck, Building2, LogOut, ChevronDown, User as UserIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import type { UserRole } from "@/types";
import { useAuth } from "@/context/auth-context";

interface UserMenuProps {
  user?: {
    name: string;
    email: string;
    role: UserRole;
    branchName?: string | null;
  } | null;
  onLogout?: () => void;
}

export function UserMenu({
  user,
  onLogout,
}: UserMenuProps) {
  const { logout } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const handleSignOut = async () => {
    setIsOpen(false);
    toast.info("Signing out of session...");
    if (onLogout) {
      onLogout();
      return;
    }
    await logout();
  };

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const roleBadgeVariants: Record<UserRole, "purple" | "default" | "info" | "secondary"> = {
    SUPERADMIN: "purple",
    ADMIN: "default",
    BRANCH_USER: "info",
    VIEWER: "secondary",
  };

  if (!user) {
    return (
      <div className="flex items-center gap-2 rounded-xl p-1.5 opacity-60">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-muted-foreground animate-pulse">
          <UserIcon className="h-4 w-4" />
        </div>
      </div>
    );
  }

  const initials = (user.name || "User")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 rounded-xl p-1.5 transition-all hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        aria-expanded={isOpen}
        aria-label="User profile menu"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-indigo-600 font-semibold text-xs text-white shadow-xs">
          {initials}
        </div>
        <div className="hidden text-left md:block">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold leading-none text-foreground">{user.name}</span>
            <Badge variant={roleBadgeVariants[user.role]} className="text-[10px] py-0 px-1.5 h-4">
              {user.role}
            </Badge>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground leading-none truncate max-w-[140px]">
            {user.branchName || user.email}
          </p>
        </div>
        <ChevronDown
          className={`hidden h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 md:block ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-border/80 glass-card p-2 shadow-2xl z-50 backdrop-blur-2xl"
          >
            <div className="border-b border-border/60 px-3 py-2.5">
              <p className="text-xs font-semibold text-foreground">{user.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
              <div className="mt-2 flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-primary" />
                <span className="text-[11px] text-muted-foreground">Role:</span>
                <Badge variant={roleBadgeVariants[user.role]} className="text-[10px] py-0 px-1.5 h-4">
                  {user.role}
                </Badge>
              </div>
              {user.branchName && (
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Building2 className="h-3 w-3 text-muted-foreground" />
                  <span>Branch: {user.branchName}</span>
                </div>
              )}
            </div>

            <div className="pt-1.5">
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out of Session</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
