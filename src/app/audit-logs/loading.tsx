import { LoadingState } from "@/components/feedback/loading-state";

export default function AuditLogsLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <LoadingState
        message="Loading Audit Logs..."
        description="Retrieving security events, governance records, and audit trails."
      />
    </div>
  );
}
