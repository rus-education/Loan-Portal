"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  React.useEffect(() => {
    console.error("Global application boundary captured error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 antialiased">
        <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900/95 p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white mb-2">
            System Error Encountered
          </h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            The portal encountered an unhandled exception at the root application layer.
            {error?.digest ? (
              <span className="block mt-2 font-mono text-xs text-slate-500">
                Digest: {error.digest}
              </span>
            ) : null}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => reset()}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-all active:scale-[0.98]"
            >
              Reload Application
            </button>
            <button
              onClick={() => {
                router.push("/");
              }}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
            >
              Return Home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
