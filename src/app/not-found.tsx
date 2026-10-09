import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground ring-8 ring-muted/20">
        <FileQuestion className="h-8 w-8" />
      </div>
      <h2 className="mt-4 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        Page or Resource Not Found
      </h2>
      <p className="mt-1.5 max-w-sm text-xs text-muted-foreground">
        The loan portal route or record identifier you are trying to reach does not exist or may have been moved.
      </p>
      <div className="mt-6">
        <Button asChild size="sm" className="gap-2">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Dashboard</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
