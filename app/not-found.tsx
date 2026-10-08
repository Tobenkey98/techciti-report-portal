import Link from "next/link";
import { SearchX } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main-content" className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div aria-hidden className="brand-glow pointer-events-none absolute inset-0 -z-10" />

      <header className="border-b border-border/70">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <Logo showSub />
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="w-full max-w-lg rounded-card border border-border/70 bg-surface p-8 text-center shadow-card ring-1 ring-black/[0.02] sm:p-10">
          <span className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-primary-soft text-primary shadow-brand-soft">
            <SearchX className="size-8" aria-hidden />
          </span>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-primary">Error 404</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Page not found
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            The page you were looking for does not exist or has moved. Head back to the
            portal to continue.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/">Go to TechCiti</Link>
            </Button>
          </div>
        </div>
      </div>

      <footer className="border-t border-border/70 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} TechCiti · techciti.ng
      </footer>
    </main>
  );
}
