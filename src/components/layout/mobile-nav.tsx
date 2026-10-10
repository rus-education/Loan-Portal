"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Layers } from "lucide-react";
import { getNavItemsForRole } from "@/config/navigation";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole?: UserRole | null;
}

export function MobileNav({
  isOpen,
  onClose,
  currentRole,
}: MobileNavProps) {
  const pathname = usePathname();

  React.useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  if (!isOpen) return null;

  const filteredItems = getNavItemsForRole(currentRole);

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 flex w-72 flex-col bg-background/95 border-r border-border/80 p-5 shadow-2xl backdrop-blur-xl animate-in slide-in-from-left duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-indigo-600 text-white shadow-md">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-foreground">LOAN PORTAL</span>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Enterprise</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-4 flex-1 space-y-1.5 overflow-y-auto">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Navigation Menu
          </p>
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </div>
                {item.badge && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="pt-4 border-t border-border/60 text-[11px] text-muted-foreground">
          <p className="font-semibold text-foreground">Role: {currentRole}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Secure Session Active</p>
        </div>
      </div>
    </div>
  );
}
