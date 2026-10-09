"use client";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Root error boundary. Required by the App Router — without it a runtime
 * error leaves Next with nothing to render and the dev server falls into a
 * "missing required error components, refreshing…" loop.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md p-8 text-center shadow-card">
          <div className="flex justify-center">
            <Logo showSub markClassName="size-10" />
          </div>
          <h1 className="mt-6 text-2xl font-extrabold tracking-tight">Something went wrong</h1>
          <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
            The page ran into a problem and could not be shown.
            {process.env.NODE_ENV === "development" && error?.message ? (
              <span className="mt-2 block break-words font-mono text-xs">{error.message}</span>
            ) : null}
          </p>
          <Button onClick={() => reset()} className="mt-6">
            Try again
          </Button>
        </Card>
      </body>
    </html>
  );
}
