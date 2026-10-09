"use client";

import * as React from "react";
import { ErrorState } from "@/components/feedback/error-state";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function LoansError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Loans section error boundary triggered:", error);
  }, [error]);

  return (
    <DashboardShell>
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <ErrorState
          title="Failed to Load Loan Applications"
          description="We encountered an issue retrieving the loan records. Please try reloading or check your connectivity."
          error={error}
          onRetry={() => reset()}
        />
      </div>
    </DashboardShell>
  );
}
