"use client";

import * as React from "react";
import { CalendarDays, ClipboardList, PartyPopper, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { InvalidLink } from "@/components/instructor/invalid-link";
import { ReportDrawer } from "@/components/instructor/report-drawer";
import { StudentReportCard } from "@/components/instructor/student-report-card";
import { MonthPicker } from "@/components/shared/month-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { SkeletonStudentCard } from "@/components/ui/skeleton";
import { useAsyncData } from "@/hooks/use-async-data";
import { portal } from "@/lib/api";
import type { InstructorPortalData, PortalStudentCard } from "@/lib/types";
import { cn, firstName, formatMonth, getCurrentMonth } from "@/lib/utils";

export function InstructorPortal({ token }: { token: string }) {
  const [month, setMonth] = React.useState(() => getCurrentMonth());
  const [openCard, setOpenCard] = React.useState<PortalStudentCard | null>(null);

  const { data, loading, error, refresh } = useAsyncData<InstructorPortalData>(
    () => portal.getPortal(token, month),
    [token, month],
  );

  if (error) return <InvalidLink token={token} />;

  const summary = data?.summary;
  const submitted = summary?.submitted ?? 0;
  const total = summary?.total ?? 0;
  const percent = total > 0 ? Math.round((submitted / total) * 100) : 0;
  const allDone = total > 0 && submitted === total;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Ambient glow */}
      <div aria-hidden className="brand-glow pointer-events-none fixed inset-x-0 top-0 -z-10 h-[28rem]" />

      {/* Sticky brand bar */}
      <header className="glass sticky top-0 z-30 border-b border-border/70 shadow-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <Logo showSub />
          <Badge variant="primary" className="hidden sm:inline-flex">
            Tutor portal
          </Badge>
        </div>
      </header>

      {/* Modern hero panel */}
      <section className="relative mx-auto mt-6 w-full max-w-5xl px-5 sm:px-8">
        <div className="brand-gradient relative overflow-hidden rounded-3xl px-6 py-8 text-primary-foreground shadow-brand sm:px-9 sm:py-10">
          <div className="hero-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-16 size-56 rounded-full bg-primary-foreground/15 blur-2xl"
          />
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-foreground/85">
              {formatMonth(month)} reporting
            </p>
            <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Hi, {data ? firstName(data.instructor.fullName) : "there"}
            </h1>
            <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-primary-foreground/90">
              Tap a student to fill their report. Everything saves automatically — you can
              finish later.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-5 shrink-0" aria-hidden />
                <label htmlFor="tutor-month" className="sr-only">
                  Reporting month
                </label>
                <MonthPicker
                  id="tutor-month"
                  value={month}
                  onChange={setMonth}
                  className="min-w-[180px] border-primary-foreground/40 bg-surface text-foreground"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <main id="main-content" className="mx-auto -mt-6 w-full max-w-5xl px-5 sm:px-8">
        {/* Progress */}
        <div className="rounded-card border border-border/70 bg-surface p-5 shadow-card ring-1 ring-black/[0.02] sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-foreground">
                {loading && !data
                  ? "Loading your students…"
                  : `${submitted} of ${total} reports submitted`}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {allDone
                  ? "All done — thank you! You can still review anything you submitted."
                  : summary
                    ? `${summary.inProgress} in progress · ${summary.notStarted} not started`
                    : " "}
              </p>
            </div>
            <span
              className={cn(
                "text-2xl font-extrabold tabular",
                allDone ? "text-success" : "text-primary",
              )}
            >
              {percent}%
            </span>
          </div>

          <Progress
            value={percent}
            className="mt-4 h-2.5"
            indicatorClassName={allDone ? "bg-success" : "bg-primary"}
            aria-label={`${submitted} of ${total} reports submitted`}
          />

          {allDone ? (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm font-semibold text-success">
              <PartyPopper className="size-4 shrink-0" aria-hidden />
              Every student is reported for {formatMonth(month)}. Great work!
            </p>
          ) : null}
        </div>

        {/* Student list */}
        <section className="mt-8" aria-labelledby="students-heading">
          <div className="flex items-end justify-between gap-3">
            <h2 id="students-heading" className="text-lg font-bold tracking-tight">
              Your students
            </h2>
            {data ? (
              <span className="text-sm text-muted-foreground">
                {total} assigned to you
              </span>
            ) : null}
          </div>

          <div className="mt-4">
            {loading && !data ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <SkeletonStudentCard key={index} />
                ))}
              </div>
            ) : data && data.students.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.students.map((card) => (
                  <StudentReportCard
                    key={card.assignmentId}
                    card={card}
                    onOpen={setOpenCard}
                    disabled={loading}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-card border border-border bg-surface shadow-card">
                <EmptyState
                  icon={<ClipboardList className="size-6" aria-hidden />}
                  title="No students assigned yet"
                  description="Once the TechCiti admin assigns students to you, they will appear here with one report card each."
                />
              </div>
            )}
          </div>
        </section>

        {/* Help */}
        <section className="mt-8 rounded-card border border-border bg-primary-soft/70 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface text-primary">
                <Sparkles className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-[15px] font-bold">Need help with a report?</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Message the TechCiti team on WhatsApp — we usually reply within a few hours.
                </p>
              </div>
            </div>
            <Button asChild variant="secondary" className="shrink-0">
              <a
                href="https://wa.me/2348012345678?text=Hello%20TechCiti%2C%20I%20need%20help%20with%20a%20tutor%20report."
                target="_blank"
                rel="noopener noreferrer"
              >
                Chat on WhatsApp
              </a>
            </Button>
          </div>
        </section>
      </main>

      {data ? (
        <ReportDrawer
          key={openCard?.assignmentId ?? "closed"}
          card={openCard}
          instructor={data.instructor}
          month={month}
          open={Boolean(openCard)}
          onOpenChange={(open) => {
            if (!open) setOpenCard(null);
          }}
          onSubmitted={() => {
            void refresh();
          }}
        />
      ) : null}
    </div>
  );
}