import * as React from "react";
import { TechCitiMark } from "@/components/brand/logo";
import { PROGRESS_RATINGS, type ReportWithContext } from "@/lib/types";
import { formatDate, formatMonth } from "@/lib/utils";

/**
 * The branded, printable report layout.
 *
 * This is the single source of truth for how a report looks — the screen
 * preview, the browser print and (once wired up) the server-rendered PDF/Word
 * output all use this same markup.
 */
export function ReportDocument({ report }: { report: ReportWithContext }) {
  const ratingIndex = report.progressRating
    ? PROGRESS_RATINGS.indexOf(report.progressRating)
    : -1;

  return (
    <article className="print-page mx-auto w-full max-w-3xl rounded-card border border-border bg-surface shadow-card">
      {/* Masthead */}
      <header className="slant-bottom relative overflow-hidden bg-primary px-7 py-7 text-primary-foreground sm:px-10 sm:py-9">
        <div className="hero-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-center gap-3">
            <TechCitiMark className="size-11 rounded-xl" />
            <div>
              <p className="text-lg font-extrabold leading-none tracking-tight">
                Tech<span className="text-primary-foreground">Citi</span>
              </p>
              <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-primary-foreground/85">
                Learning Report
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-foreground/85">
              Reporting month
            </p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight">
              {formatMonth(report.month)}
            </p>
            <p className="mt-1 font-mono text-[11px] text-primary-foreground/80">
              Ref {report.id}
            </p>
          </div>
        </div>
      </header>

      <div className="px-7 pb-8 pt-10 sm:px-10">
        {/* Student summary */}
        <section className="rounded-card border border-border bg-background/70 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Student
              </p>
              <h1 className="mt-1 text-xl font-extrabold tracking-tight text-foreground">
                {report.studentName}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {report.grade} · {report.subject}
              </p>
            </div>

            <div className="text-left sm:text-right">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Tutor
              </p>
              <p className="mt-1 font-semibold text-foreground">{report.instructorName}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Submitted {formatDate(report.submittedAt)}
              </p>
            </div>
          </div>
        </section>

        {/* Progress */}
        <Section title="Progress this month">
          {report.progressRating ? (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1" aria-hidden>
                {PROGRESS_RATINGS.map((rating, index) => (
                  <span
                    key={rating}
                    className={
                      index <= ratingIndex
                        ? "size-3.5 rounded-full bg-primary"
                        : "size-3.5 rounded-full border-2 border-border"
                    }
                  />
                ))}
              </div>
              <p className="text-lg font-extrabold tracking-tight text-foreground">
                {report.progressRating}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">Not rated.</p>
          )}
        </Section>

        {/* Topics */}
        <Section title="Topics covered this month">
          {report.topicsCovered ? (
            <ul className="space-y-1.5">
              {report.topicsCovered
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line, index) => (
                  <li key={index} className="flex gap-2.5 text-[15px] leading-relaxed text-foreground">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    <span>{line.replace(/^\d+[.)]\s*/, "")}</span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Not recorded.</p>
          )}
        </Section>

        {/* Feedback */}
        <Section title="General feedback">
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground">
            {report.generalFeedback || "Not recorded."}
          </p>
        </Section>

        {/* Continuity */}
        <Section title="What should continue next month">
          {report.continuityNeeded ? (
            <div className="rounded-card border border-primary/25 bg-primary-soft p-4">
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground">
                {report.continuityNote || "To be confirmed with the tutor."}
              </p>
            </div>
          ) : (
            <p className="text-[15px] text-muted-foreground">
              No continuity required — the student is on track for next month.
            </p>
          )}
        </Section>

        {/* Tutor comment — internal */}
        {report.tutorComment ? (
          <Section title="Tutor's comment" subtitle="Internal note — not shared with parents">
            <p className="whitespace-pre-line rounded-card border border-dashed border-border bg-background p-4 text-[15px] leading-relaxed text-foreground">
              {report.tutorComment}
            </p>
          </Section>
        ) : null}

        {/* Sign-off */}
        <div className="mt-10 grid gap-8 border-t border-border pt-8 sm:grid-cols-2">
          <SignatureLine label="Tutor" name={report.instructorName} date={report.submittedAt} />
          <SignatureLine label="Parent / guardian" />
        </div>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-xs text-muted-foreground">
          <p>
            Generated by the TechCiti Tutor Report Portal · techciti.ng
          </p>
          <p>Document reference {report.id}</p>
        </footer>
      </div>
    </article>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-primary">
          {title}
        </h2>
        {subtitle ? <span className="text-xs text-muted-foreground">{subtitle}</span> : null}
      </div>
      <div className="mt-3 border-l-2 border-primary-soft pl-4">{children}</div>
    </section>
  );
}

function SignatureLine({ label, name, date }: { label: string; name?: string | null; date?: string | null }) {
  return (
    <div>
      <div className="h-10 border-b border-foreground/30" />
      <p className="mt-2 text-sm font-semibold text-foreground">{name || ""}</p>
      <p className="text-xs text-muted-foreground">
        {label}
        {date ? ` · ${formatDate(date)}` : ""}
      </p>
    </div>
  );
}