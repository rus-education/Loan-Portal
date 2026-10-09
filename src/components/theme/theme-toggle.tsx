"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={className}
        aria-label="Toggle theme placeholder"
      >
        <span className="h-4 w-4 rounded-full bg-muted animate-pulse" />
      </Button>
    );
  }

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      className={className}
      title={`Theme: ${theme || "system"}. Click to change.`}
      aria-label="Toggle theme"
    >
      {theme === "light" && <Sun className="h-4 w-4 text-amber-500 transition-transform" />}
      {theme === "dark" && <Moon className="h-4 w-4 text-sky-400 transition-transform" />}
      {theme === "system" && <Monitor className="h-4 w-4 text-muted-foreground transition-transform" />}
    </Button>
  );
}
