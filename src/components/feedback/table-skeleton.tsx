"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({
  rows = 5,
  columns = 6,
  className = "",
}: TableSkeletonProps) {
  return (
    <div className={`w-full overflow-hidden rounded-xl border border-border/60 ${className}`}>
      {/* Table Header Skeleton */}
      <div className="flex items-center gap-4 border-b border-border/60 bg-muted/30 px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton
            key={`th-${i}`}
            className="h-3.5"
            style={{ width: `${Math.max(12, 100 / columns - 3)}%` }}
          />
        ))}
      </div>

      {/* Table Rows Skeleton */}
      <div className="divide-y divide-border/40 bg-card/40">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div
            key={`row-${rIdx}`}
            className="flex items-center gap-4 px-4 py-3.5 transition-colors"
          >
            {Array.from({ length: columns }).map((_, cIdx) => (
              <div
                key={`cell-${rIdx}-${cIdx}`}
                style={{ width: `${Math.max(12, 100 / columns - 3)}%` }}
              >
                <Skeleton
                  className={`h-4 ${
                    cIdx === 0
                      ? "w-2/3"
                      : cIdx === 1
                      ? "w-4/5"
                      : cIdx === columns - 1
                      ? "w-1/2 ml-auto"
                      : "w-3/4"
                  }`}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={`card-skel-${idx}`}
          className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-7 rounded-lg" />
          </div>
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}
