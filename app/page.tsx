import Link from "next/link";
import { ArrowRight, BookOpenCheck, ClipboardList, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DEMO_TUTOR_LINKS } from "@/lib/mock-data";
import { firstName } from "@/lib/utils";

export default function HomePage() {
  return (
    <main id="main-content" className="min-h-screen bg-background">
      {/* Hero — orange block with the signature slanted bottom edge. */}
      <section className="slant-bottom relative overflow-hidden bg-primary pb-28 pt-14 text-primary-foreground sm:pt-20">
        <div className="hero-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden />
        <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2.5">
              <Logo invert showSub markClassName="size-10" />
            </span>
            <Badge className="border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground">
              Frontend demo · mock data
            </Badge>
          </div>

          <div className="mt-14 max-w-3xl sm:mt-20">
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Monthly tutor reports, without the paperwork.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-primary-foreground/90">
              Tutors fill a short, dropdown-driven form on their phone. Admins see
              exactly who is done, who is not, and can open any report as a branded PDF
              or Word document in one click.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" variant="secondary" className="text-primary">
                <Link href="/admin">
                  Open admin portal
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-primary-foreground/50 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <Link href="#demo-links">Preview a tutor link</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto -mt-14 w-full max-w-6xl px-5 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <FeatureCard
            icon={<Sparkles className="size-5" aria-hidden />}
            title="Two minutes per student"
            body="Quick-add topic chips, sensible defaults and autosave drafts while the lesson is still fresh."
          />
          <FeatureCard
            icon={<ShieldCheck className="size-5" aria-hidden />}
            title="Private tutor links"
            body="No login for tutors. Each tutor gets one unguessable link that can be revoked at any time."
          />
          <FeatureCard
            icon={<BookOpenCheck className="size-5" aria-hidden />}
            title="Branded documents"
            body="Every report opens as a clean, printable TechCiti document ready for parents and records."
          />
        </div>

        <section id="demo-links" className="py-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">Try a tutor link</h2>
              <p className="mt-1.5 text-[15px] text-muted-foreground">
                Every tutor has a private portal. Open one as the tutor would see it.
              </p>
            </div>
            <Button asChild variant="ghost">
              <Link href="/t/this-token-does-not-exist">
                See the invalid-link state
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>

          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DEMO_TUTOR_LINKS.map((tutor) => (
              <li key={tutor.id}>
                <Card className="h-full p-5 transition-shadow hover:shadow-card-hover">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-foreground">{tutor.fullName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {tutor.subjects.join(" · ")}
                      </p>
                    </div>
                    <Badge variant="primary">{firstName(tutor.fullName)}</Badge>
                  </div>
                  <Button asChild variant="secondary" size="sm" className="mt-4 w-full">
                    <Link href={tutor.path}>
                      Open portal
                      <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        <section className="pb-16">
          <Card className="flex flex-col items-start gap-5 bg-surface p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <ClipboardList className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-lg font-bold">Admin sign in</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Manage tutors, students, assignments and reports.
                </p>
              </div>
            </div>
            <Button asChild size="lg">
              <Link href="/admin/login">
                Go to admin login
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </Card>
        </section>
      </div>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Card className="p-5 shadow-card-hover sm:p-6">
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
        {icon}
      </span>
      <h3 className="mt-4 text-base font-bold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </Card>
  );
}