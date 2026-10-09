import { LoadingState } from "@/components/feedback/loading-state";

export default function BranchesLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <LoadingState
        message="Loading Branch Network..."
        description="Fetching branch offices, operational statuses, and loan volume summaries."
      />
    </div>
  );
}
