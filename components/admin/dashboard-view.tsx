"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  PartyPopper,
  Users,
} from "lucide-react";
import { MonthPicker } from "@/components/shared/month-picker";
import { PageHeader, SectionHeading } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { WhatsAppIconButton } from "@/components/shared/whatsapp-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, SkeletonStatCard } from "@/components/ui/skeleton";
import { useAsyncData } from "@/hooks/use-async-data";
import { dashboard } from "@/lib/api";
import { messages } from "@/lib/messages";
import type { DashboardData } from "@/lib/types";
import {
  firstName,
  formatMonth,
  getCurrentMonth,
  pluralise,
  relativeTime,
  whatsappLink,
} from "@/lib/utils";

export function DashboardView() {
  const [month, setMonth] = React.useState(() => getCurrentMonth());

  const { data, loading } = useAsyncData<DashboardData>(
    () => dashboard.get(month),
    [month],
  );

  const stats = data?.stats;
  const completion = stats && stats.expected > 0 ? Math.round((stats.submitted / stats.expected) * 100) : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={`Submission overview for ${data ? formatMonth(month) : "this month"}.`}
        actions={<MonthPicker value={month} onChange={setMonth} aria-label="Dashboard month" />}
      />

      {/* Stat cards */}
      <section aria-label="Key numbers" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading && !data ? (
          <>
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonStatCard key={index} />
            ))}
          </>
        ) : (
          <>
            <StatCard
              label="Total tutors"
              value={stats?.totalInstructors ?? 0}
              hint={`${stats?.activeInstructors ?? 0} active`}
              icon={<GraduationCap className="size-5" aria-hidden />}
              tone="primary"
            />
            <StatCard
              label="Total students"
              value={stats?.totalStudents ?? 0}
              hint={`${stats?.activeStudents ?? 0} active`}
              icon={<Users className="size-5" aria-hidden />}
              tone="neutral"
            />
            <StatCard
              label="Submitted"
              value={stats?.submitted ?? 0}
              hint={`of ${stats?.expected ?? 0} expected`}
              icon={<CheckCircle2 className="size-5" aria-hidden />}
              tone="success"
            />
            <StatCard
              label="Pending"
              value={stats?.pending ?? 0}
              hint={`${completion}% complete`}
              icon={<Clock3 className="size-5" aria-hidden />}
              tone={stats?.pending ? "warning" : "success"}
            />
          </>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* Outstanding tutors */}
        <section className="space-y-4" aria-labelledby="outstanding-heading">
          <SectionHeading
            title="Waiting on these tutors"
            description="Tutors with reports still outstanding this month."
          />

          <Card className="overflow-hidden">
            {loading && !data ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 w-full" />
                ))}
              </div>
            ) : data && data.outstanding.length > 0 ? (
              <ul className="divide-y divide-border">
                {data.outstanding.map((entry) => (
                  <TutorReminderRow key={entry.instructor.id} entry={entry} month={month} />
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<PartyPopper className="size-6" aria-hidden />}
                title="Every tutor is done"
                description={`All reports for ${formatMonth(month)} have been submitted. Time for a well-earned breather.`}
              />
            )}
          </Card>
        </section>

        {/* Recent submissions */}
        <section className="space-y-4" aria-labelledby="recent-heading">
          <SectionHeading
            title="Recent submissions"
            description="Latest activity from the tutor portal."
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/reports">
                  View all
                  <ArrowUpRight aria-hidden />
                </Link>
              </Button>
            }
          />

          <Card className="overflow-hidden">
            {loading && !data ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 w-full" />
                ))}
              </div>
            ) : data && data.recent.length > 0 ? (
              <ul className="divide-y divide-border">
                {data.recent.map((report) => (
                  <li key={report.id}>
                    <Link
                      href={`/admin/reports/${report.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-primary-soft/50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-foreground">
                          {report.studentName}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {report.subject} · {report.grade} · {report.instructorName}
                        </span>
                      </span>
                      <span className="hidden shrink-0 text-right sm:block">
                        <StatusBadge status={report.status} />
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {relativeTime(report.submittedAt ?? report.updatedAt)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<ClipboardCheck className="size-6" aria-hidden />}
                title="No submissions yet"
                description="Submitted reports will appear here as tutors send them in."
              />
            )}
          </Card>

          {/* Coverage bar */}
          {stats && stats.expected > 0 ? (
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-foreground">Monthly completion</p>
                <p className="text-sm font-extrabold tabular text-primary">
                  {stats.submitted}/{stats.expected}
                </p>
              </div>
              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-primary-soft">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${completion}%` }}
                  role="progressbar"
                  aria-valuenow={completion}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Reports submitted this month"
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {completion === 100
                  ? "All done for this month."
                  : `${pluralise(stats.pending, "report")} still outstanding.`}
              </p>
            </Card>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function TutorReminderRow({
  entry,
  month,
}: {
  entry: DashboardData["outstanding"][number];
  month: string;
}) {
  const percentage = entry.total > 0 ? Math.round((entry.submitted / entry.total) * 100) : 0;

  return (
    <li className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[15px] font-bold text-foreground">{entry.instructor.fullName}</p>
          <Badge variant="warning">
            {pluralise(entry.outstanding, "report")} pending
          </Badge>
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {entry.submitted} of {entry.total} done · {entry.students.slice(0, 3).join(", ")}
          {entry.students.length > 3 ? ` +${entry.students.length - 3} more` : ""}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-primary-soft">
            <div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} />
          </div>
          <span className="text-xs font-semibold tabular text-muted-foreground">
            {percentage}%
          </span>
        </div>
      </div>

      <WhatsAppIconButton
        phone={entry.instructor.phone}
        label={`Remind ${entry.instructor.fullName} on WhatsApp`}
        message={messages.tutorReminder({
          tutorFirstName: firstName(entry.instructor.fullName),
          month: formatMonth(month),
          outstanding: entry.outstanding,
          link: `/t/${entry.instructor.token}`,
        })}
      />

      <Button
        asChild
        variant="secondary"
        size="sm"
        className="w-full shrink-0 sm:w-auto"
      >
        <a
          href={reminderLink(entry.instructor.phone, entry.instructor.fullName, entry.instructor.token, entry.outstanding, month)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <BellRing aria-hidden />
          Remind on WhatsApp
        </a>
      </Button>
    </li>
  );
}

/** Builds the wa.me deep link with the tutor's absolute portal URL. */
function reminderLink(
  phone: string,
  tutorName: string,
  token: string,
  outstanding: number,
  month: string,
): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return whatsappLink(
    phone,
    messages.tutorReminder({
      tutorFirstName: firstName(tutorName),
      month: formatMonth(month),
      outstanding,
      link: `${origin}/t/${token}`,
    }),
  );
}