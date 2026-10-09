"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  const { theme = "system" } = useTheme();

  return (
    <SonnerToaster
      theme={theme as "light" | "dark" | "system"}
      position="top-right"
      closeButton
      richColors
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card/95 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-foreground group-[.toaster]:border-border/80 group-[.toaster]:shadow-2xl group-[.toaster]:rounded-xl font-sans text-xs border py-3 px-4",
          description: "group-[.toast]:text-muted-foreground text-[11px] leading-relaxed",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground text-xs font-semibold px-2.5 py-1 rounded-md",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground text-xs font-medium px-2.5 py-1 rounded-md",
          success: "!border-emerald-500/30 !bg-emerald-500/10 !text-emerald-700 dark:!text-emerald-300",
          error: "!border-rose-500/30 !bg-rose-500/10 !text-rose-700 dark:!text-rose-300",
          info: "!border-sky-500/30 !bg-sky-500/10 !text-sky-700 dark:!text-sky-300",
          warning: "!border-amber-500/30 !bg-amber-500/10 !text-amber-700 dark:!text-amber-300",
        },
      }}
    />
  );
}

export { toast } from "sonner";
