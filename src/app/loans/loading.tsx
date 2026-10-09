import { LoadingState } from "@/components/feedback/loading-state";

export default function LoansLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <LoadingState
        message="Loading Loan Applications..."
        description="Streaming application records and filtering parameters."
      />
    </div>
  );
}
