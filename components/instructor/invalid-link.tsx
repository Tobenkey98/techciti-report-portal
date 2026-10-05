import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

/**
 * Shown when a tutor opens a link that has been revoked, mistyped or retired.
 * Warm and human — never a raw error code.
 */
export function InvalidLink({ token }: { token?: string }) {
  return (
    <main id="main-content" className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <Logo showSub />
          <Button asChild variant="ghost" size="sm">
            <Link href="/">Back to TechCiti</Link>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-5 py-14 sm:px-8">
        <div className="w-full max-w-lg text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <LifeBuoy className="size-8" aria-hidden />
          </span>

          <h1 className="mt-7 text-2xl font-extrabold tracking-tight sm:text-3xl">
            This link isn&apos;t valid
          </h1>

          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            The tutor portal link you opened is not active. It may have been replaced by a
            newer one. Please contact the TechCiti admin and we&apos;ll send you a fresh
            link right away.
          </p>

          {token ? (
            <p className="mt-5 inline-block rounded-lg bg-surface px-3 py-2 font-mono text-xs text-muted-foreground ring-1 ring-border">
              Link used: /t/{token}
            </p>
          ) : null}

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/">Go to TechCiti</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="https://wa.me/2348012345678?text=Hello%20TechCiti%2C%20my%20tutor%20portal%20link%20is%20not%20working." target="_blank" rel="noopener noreferrer">
                Contact admin on WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}