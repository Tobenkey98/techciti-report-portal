import Link from "next/link";
import { SearchX } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main-content" className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <Logo showSub />
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="max-w-lg text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <SearchX className="size-8" aria-hidden />
          </span>
          <h1 className="mt-7 text-2xl font-extrabold tracking-tight sm:text-3xl">
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
            <Button asChild size="lg" variant="outline">
              <Link href="/admin">Admin portal</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}