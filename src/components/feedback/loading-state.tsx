import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  description?: string;
  className?: string;
  size?: "sm" | "default" | "lg";
}

export function LoadingState({
  message = "Loading loan records...",
  description,
  className,
  size = "default",
}: LoadingStateProps) {
  const iconSizes = {
    sm: "h-5 w-5",
    default: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div
      className={cn(
        "flex min-h-[220px] flex-col items-center justify-center p-8 text-center animate-in fade-in-50 duration-300",
        className
      )}
    >
      <div className="relative mb-4 flex items-center justify-center">
        <div className="absolute h-14 w-14 rounded-full bg-primary/10 blur-xl animate-pulse" />
        <Loader2 className={cn("animate-spin text-primary", iconSizes[size])} />
      </div>
      <h4 className="text-sm font-semibold text-foreground tracking-tight">{message}</h4>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground max-w-sm">{description}</p>
      )}
    </div>
  );
}
