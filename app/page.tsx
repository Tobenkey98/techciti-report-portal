import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  BookOpenCheck,
  CalendarDays,
  ClipboardList,
  FileCheck2,
  Link2,
  ListChecks,
  MessageCircle,
  MousePointerClick,
  PenLine,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { TutorLinkForm } from "@/components/landing/tutor-link-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main id="main-content" className="relative min-h-screen overflow-hidden bg-background">
      {/* Ambient brand glow */}
      <div aria-hidden className="brand-glow pointer-events-none absolute inset-x-0 top-0 -z-10 h-[46rem]" />

      {/* Header — tutor-only, no admin links */}
      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-8 sm:px-8 sm:pt-10">
        <span className="inline-flex items-center gap-2.5">
          <Logo showSub markClassName="size-10" />
        </span>
        <Button asChild variant="ghost" size="sm" className="bg-surface/80 shadow-sm backdrop-blur">
          <Link href="#guide">
            How to submit
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </header>

      {/* Hero */}
      <section className="relative mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary shadow-sm backdrop-blur">
              <Sparkles className="size-3.5" aria-hidden />
              For TechCiti tutors
            </div>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Submit your monthly student reports.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Open your private link, pick the month, tap a student and fill the short
              form on your phone. Your draft saves automatically as you type.
            </p>

            <TutorLinkForm />

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild variant="outline" className="bg-surface/80 backdrop-blur">
                <Link href="#how-it-works">How it works</Link>
              </Button>
              <Button asChild variant="outline" className="bg-surface/80 backdrop-blur">
                <Link href="#faq">Questions tutors ask</Link>
              </Button>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-3 sm:gap-4">
              <StatCard label="Form time" value="~2 min" hint="Per student" />
              <StatCard label="Access" value="Private" hint="Your link only" />
              <StatCard label="Drafts" value="Autosaved" hint="Never lose work" />
            </div>
          </div>

          {/* Hero visual card */}
          <div className="relative mx-auto w-full max-w-xl lg:mx-0">
            <div
              aria-hidden
              className="absolute -right-6 -top-6 -z-10 h-40 w-40 rounded-full bg-primary/10 blur-2xl sm:-right-10 sm:-top-10"
            />
            <Card className="overflow-hidden border-border/60 shadow-lg shadow-primary/5 ring-1 ring-border/40 transition-shadow hover:shadow-xl">
              <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/40 px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                    <ClipboardList className="size-4.5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Tutor Report Form</p>
                    <p className="text-xs text-muted-foreground">Clean, dropdown-driven & mobile-first</p>
                  </div>
                </div>
                <Badge variant="primary" className="shadow-sm">
                  Draft autosaved
                </Badge>
              </div>
              <div className="space-y-5 bg-surface/95 p-6 sm:p-8">
                <div className="grid gap-4 sm:grid-cols-2">
                  <PreviewField label="Student" value="Adaora Nnamdi" />
                  <PreviewField label="Course" value="Mobile App Development" />
                  <PreviewField label="Level" value="Beginner" />
                  <PreviewField label="Month" value="October 2026" />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Topics covered
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["UI Basics", "Navigation", "State Management"].map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="border-border/60 bg-background/90 px-2.5 py-0.5 text-xs shadow-sm"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Tutor remarks
                  </p>
                  <p className="text-sm leading-relaxed text-foreground">
                    Student is making solid progress. Needs more practice with component
                    reusability.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-5">
                  <p className="text-xs text-muted-foreground">
                    Last autosave • Saved 2 minutes ago
                  </p>
                  <Button size="sm" className="shadow-sm">
                    Submit report
                    <ArrowRight className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative mx-auto w-full max-w-6xl px-5 pb-10 sm:px-8 sm:pb-14">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">How it works</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            Three steps, every month. Your admin handles everything else — adding
            tutors, students and courses.
          </p>
        </div>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            {
              step: "1",
              title: "Get your private link",
              body: "Your admin creates your tutor record and sends you one private link on WhatsApp. It works every month — bookmark it.",
            },
            {
              step: "2",
              title: "Open it and pick the month",
              body: "Paste the link above or tap it in WhatsApp. Confirm the reporting month at the top of your portal.",
            },
            {
              step: "3",
              title: "Fill and submit each student",
              body: "Tap a student card, answer the short form, then submit. Drafts save automatically if you get interrupted.",
            },
          ].map((item) => (
            <li key={item.step}>
              <Card className="group h-full p-6 lift">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <span className="text-lg font-extrabold">{item.step}</span>
                </span>
                <h3 className="mt-5 text-lg font-bold">{item.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{item.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* Step-by-step guide */}
      <section id="guide" className="relative mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Your step-by-step reporting guide
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            Everything you see inside your portal, explained. Read it once and the
            monthly routine takes about two minutes per student.
          </p>
        </div>

        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <GuideCard
            icon={<Link2 className="size-5" aria-hidden />}
            step="Step 1"
            title="Open your private link"
            body="Tap the link your admin sent you. It opens straight to your students — no username, no password. If the page says the link is invalid, the link was typed incompletely or revoked: ask your admin to resend it."
            accent="bg-primary/10 text-primary"
          />
          <GuideCard
            icon={<CalendarDays className="size-5" aria-hidden />}
            step="Step 2"
            title="Confirm the month"
            body="The month picker at the top defaults to the current month. You cannot report for a future month. Switch months to review what you already submitted."
            accent="bg-success/10 text-success"
          />
          <GuideCard
            icon={<MousePointerClick className="size-5" aria-hidden />}
            step="Step 3"
            title="Tap a student card"
            body="You see one card per student and course assigned to you. The badge tells you the state: Not started, Draft, or Submitted. Tap a card to open its report form."
            accent="bg-warning/10 text-warning"
          />
          <GuideCard
            icon={<PenLine className="size-5" aria-hidden />}
            step="Step 4"
            title="Fill the form"
            body="Topics covered (tap the quick-add chips to build a numbered list), whether continuity is needed next month, general feedback for the parent, a private comment for the admin, and a progress rating from Excellent to Needs attention."
            accent="bg-primary/10 text-primary"
          />
          <GuideCard
            icon={<Save className="size-5" aria-hidden />}
            step="Step 5"
            title="Drafts save themselves"
            body="Your answers autosave every few seconds — you can close the page and continue later. Press “Save draft” before leaving if you want to be sure, and “Submit” only when the report is final."
            accent="bg-success/10 text-success"
          />
          <GuideCard
            icon={<Send className="size-5" aria-hidden />}
            step="Step 6"
            title="After you submit"
            body="A submitted report locks so it stays trustworthy. If the admin needs changes, the card shows their note and unlocks the form — update it and submit again."
            accent="bg-warning/10 text-warning"
          />
        </ol>

        {/* Before you start */}
        <Card className="mt-8 p-6 sm:p-8">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <ListChecks className="size-5 text-primary" aria-hidden />
            Before you start, have these ready
          </h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              "Your private portal link (from WhatsApp — bookmark it).",
              "The reporting month you are filling (usually the current one).",
              "The topics you actually covered with each student.",
              "An honest read on progress — the rating guides extra help.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-muted-foreground">
                <FileCheck2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Questions tutors ask</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            Quick answers to the things tutors ask us most.
          </p>
        </div>
        <div className="mt-8 grid gap-3 lg:grid-cols-2">
          <FaqItem
            question="Where do I get my private link?"
            answer="Your TechCiti admin creates your tutor record and sends the link on WhatsApp. Each tutor has exactly one link and it works every month — there is nothing to sign up for."
          />
          <FaqItem
            question="Do I need an account or a password?"
            answer="No. Your private link is your access. Keep it to yourself and bookmark it so it is always one tap away."
          />
          <FaqItem
            question="Which month should I report for?"
            answer="The current month, which the portal selects for you. You cannot submit for a future month. You can look back at earlier months to see submitted reports."
          />
          <FaqItem
            question="Can I change a report after submitting?"
            answer="Submitted reports lock to keep records trustworthy. Keep working in drafts until you are sure, then submit. If the admin requests changes, you will see their note on the card and the form will unlock for resubmission."
          />
          <FaqItem
            question="My link does not open. What now?"
            answer="Make sure you pasted the complete link — it ends with /t/ followed by a code. If it still fails, the link may have been regenerated: ask your admin to send the current one."
          />
          <FaqItem
            question="What should I write in the report?"
            answer="Topics you genuinely covered (the quick-add chips speed this up), whether the student needs continuity next month, clear feedback a parent can understand, a private note for the admin, and an honest progress rating."
          />
        </div>
      </section>

      {/* Help */}
      <section className="relative mx-auto w-full max-w-6xl px-5 pb-14 sm:px-8 sm:pb-20">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-success/10 text-success">
                <MessageCircle className="size-6" aria-hidden />
              </span>
              <div>
                <h2 className="text-xl font-extrabold tracking-tight">Stuck on a report?</h2>
                <p className="mt-1 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                  Message the TechCiti team on WhatsApp — for a lost link, contact your
                  admin first, since only they can resend or regenerate it.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild>
                <a
                  href="https://wa.me/2348012345678?text=Hello%20TechCiti%2C%20I%20need%20help%20with%20a%20tutor%20report."
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <BellRing aria-hidden />
                  Chat on WhatsApp
                </a>
              </Button>
              <Button asChild variant="outline">
                <Link href="#faq">
                  <BookOpenCheck aria-hidden />
                  Read the FAQ
                </Link>
              </Button>
            </div>
          </div>
        </Card>
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          Your link is personal. Reports you submit go straight to the TechCiti admin team.
        </div>
      </section>

      {/* Footer — no admin links */}
      <footer className="relative mx-auto w-full max-w-6xl border-t border-border/60 px-5 py-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2.5">
            <Logo showSub markClassName="size-9" />
          </span>
          <p className="text-sm text-muted-foreground">
            TechCiti Tutor Report Portal • Monthly reporting for tutors
          </p>
        </div>
      </footer>
    </main>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="border-border/60 bg-surface/95 px-3 py-4 text-center shadow-sm ring-1 ring-border/40 sm:px-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-foreground sm:text-xl">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">{hint}</p>
    </Card>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5 rounded-2xl border border-border/60 bg-background/95 px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function GuideCard({
  icon,
  step,
  title,
  body,
  accent,
}: {
  icon: React.ReactNode;
  step: string;
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <li>
      <Card className="group h-full p-6 lift sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <span className={`flex size-12 items-center justify-center rounded-2xl ${accent}`}>
            {icon}
          </span>
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {step}
          </span>
        </div>
        <h3 className="mt-5 text-lg font-bold">{title}</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{body}</p>
      </Card>
    </li>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group rounded-card border border-border/70 bg-surface px-5 py-4 shadow-card ring-1 ring-black/[0.02] open:shadow-card-hover">
      <summary className="cursor-pointer list-none text-[15px] font-bold text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-3">
          {question}
          <ArrowRight
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
          />
        </span>
      </summary>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{answer}</p>
    </details>
  );
}
