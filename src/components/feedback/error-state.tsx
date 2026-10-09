import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
  error?: Error | string | null;
}

export function ErrorState({
  title = "Something went wrong",
  description = "An unexpected error occurred while processing your request. Please try again.",
  onRetry,
  className,
  error,
}: ErrorStateProps) {
  const errorMessage = error instanceof Error ? error.message : typeof error === "string" ? error : null;

  return (
    <div
      className={cn(
        "flex min-h-[260px] flex-col items-center justify-center p-8 text-center glass-card border-destructive/20 bg-destructive/5 animate-in fade-in-50 duration-300",
        className
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/15 text-destructive ring-8 ring-destructive/5">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-md text-xs text-muted-foreground leading-relaxed">
        {description}
      </p>
      {errorMessage && (
        <code className="mt-3 block max-w-lg rounded-md bg-muted/60 px-3 py-1.5 font-mono text-[11px] text-destructive break-words text-left">
          {errorMessage}
        </code>
      )}
      {onRetry && (
        <div className="mt-5">
          <Button
            onClick={onRetry}
            variant="outline"
            size="sm"
            className="gap-2 border-border/80 shadow-xs hover:border-destructive/40"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Try Again</span>
          </Button>
        </div>
      )}
    </div>
  );
}
