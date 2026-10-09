import { LoadingState } from "@/components/feedback/loading-state";

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <LoadingState
        message="Loading workspace..."
        description="Initializing security context and fetching records."
      />
    </div>
  );
}
