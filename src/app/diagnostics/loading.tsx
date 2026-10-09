import { LoadingState } from "@/components/feedback/loading-state";

export default function DiagnosticsLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <LoadingState
        message="Probing System Telemetry..."
        description="Pinging database cluster and gathering runtime health indicators."
      />
    </div>
  );
}
