import * as React from "react";
import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md bg-muted/60 dark:bg-muted/40 animate-shimmer",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
