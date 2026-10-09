"use client";

import * as React from "react";
import { ErrorState } from "@/components/feedback/error-state";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Application error boundary triggered:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <ErrorState
        title="Application Exception Encountered"
        description="The system caught an unhandled render error. You can try recovering the workspace below."
        error={error}
        onRetry={() => reset()}
      />
    </div>
  );
}
