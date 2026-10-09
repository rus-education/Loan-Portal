import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title = "No loan applications found",
  description = "No records match your current filter criteria, or no applications have been submitted yet.",
  actionLabel,
  onAction,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[300px] flex-col items-center justify-center p-8 text-center glass-card border-dashed border-border/70 animate-in fade-in-50 duration-300",
        className
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground ring-8 ring-muted/20">
        {icon || <FolderOpen className="h-7 w-7 stroke-[1.5]" />}
      </div>
      <h3 className="text-base font-semibold text-foreground tracking-tight">{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs text-muted-foreground leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <div className="mt-5">
          <Button onClick={onAction} size="sm" className="gap-2 shadow-sm">
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
