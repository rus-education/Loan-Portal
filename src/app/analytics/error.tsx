"use client";

import * as React from "react";
import { ErrorState } from "@/components/feedback/error-state";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Analytics section error boundary triggered:", error);
  }, [error]);

  return (
    <DashboardShell>
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <ErrorState
          title="Analytics Service Temporarily Unavailable"
          description="Failed to load portfolio metrics or render chart aggregations. Verify administrative credentials and try again."
          error={error}
          onRetry={() => reset()}
        />
      </div>
    </DashboardShell>
  );
}
