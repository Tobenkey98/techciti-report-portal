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
    <main id="main-content" className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div aria-hidden className="brand-glow pointer-events-none absolute inset-0 -z-10" />

      <header className="border-b border-border/70">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <Logo showSub />
          <Button asChild variant="ghost" size="sm">
            <Link href="/">Back to TechCiti</Link>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-5 py-14 sm:px-8">
        <div className="w-full max-w-lg rounded-card border border-border/70 bg-surface p-8 text-center shadow-card ring-1 ring-black/[0.02] sm:p-10">
          <span className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-primary-soft text-primary shadow-brand-soft">
            <LifeBuoy className="size-8" aria-hidden />
          </span>

          <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-primary">
            Revoked link
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            This link isn&apos;t valid
          </h1>

          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            The tutor portal link you opened is not active. It may have been replaced by a
            newer one. Please contact the TechCiti admin and we&apos;ll send you a fresh
            link right away.
          </p>

          {token ? (
            <p className="mt-5 inline-block rounded-button bg-background px-3 py-2 font-mono text-xs text-muted-foreground ring-1 ring-border">
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