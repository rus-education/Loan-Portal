import { LoadingState } from "@/components/feedback/loading-state";

export default function UsersLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <LoadingState
        message="Loading Users Directory..."
        description="Fetching staff accounts, branch associations, and permissions."
      />
    </div>
  );
}
