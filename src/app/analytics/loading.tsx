import { LoadingState } from "@/components/feedback/loading-state";

export default function AnalyticsLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <LoadingState
        message="Computing Analytics & BI Aggregations..."
        description="Executing multi-dimensional aggregations and preparing visualization metrics."
      />
    </div>
  );
}
