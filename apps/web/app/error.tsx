"use client";

import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary.
 *
 * Without this, a render-time throw in any page produced the default Next.js
 * error screen with no way back into the app.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-5 py-16">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {error.message ||
            "An unexpected error occurred while rendering this page."}
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        )}
        <Button className="mt-6" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}
