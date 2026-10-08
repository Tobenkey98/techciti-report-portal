"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CalendarX2, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { RatingBadge, StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsyncData } from "@/hooks/use-async-data";
import { students as studentsApi } from "@/lib/api";
import { messages } from "@/lib/messages";
import { PROGRESS_RATINGS, type StudentProfile } from "@/lib/types";
import { cn, formatDate, formatMonth, initials, initialsAvatarColor, prettyPhone } from "@/lib/utils";

export function StudentProfileView({ studentId }: { studentId: string }) {
  const { data, loading, error } = useAsyncData<StudentProfile>(
    () => studentsApi.getProfile(studentId),
    [studentId],
  );

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full rounded-card" />
        <Skeleton className="h-96 w-full rounded-card" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-10 text-center">
        <h1 className="text-xl font-extrabold">Student not found</h1>
        <p className="mx-auto mt-2 max-w-md text-[15px] text-muted-foreground">
          This student may have been removed. Go back to the students list to pick another one.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/admin/students">
            <ArrowLeft aria-hidden />
            Back to students
          </Link>
        </Button>
      </Card>
    );
  }

  const { student, reports, subjects } = data;
  const averageIndex = data.averageRating ?? -1;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
          <Link href="/admin/students">
            <ArrowLeft aria-hidden />
            All students
          </Link>
        </Button>

        <PageHeader
          title={student.fullName}
          description={`${student.grade} · ${subjects.length ? subjects.join(", ") : "No subjects assigned"}`}
          actions={
            <Button asChild variant="secondary">
              <a
                href={parentLink(student.parentPhone, student.fullName)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle aria-hidden />
                Message parent
              </a>
            </Button>
          }
        />
      </div>

      {/* Summary card */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span
              className={cn(
                "flex size-16 shrink-0 items-center justify-center rounded-full text-xl font-bold",
                initialsAvatarColor(student.id),
              )}
              aria-hidden
            >
              {initials(student.fullName)}
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-lg font-extrabold tracking-tight">
                {student.fullName}
                {student.status === "active" ? (
                  <Badge variant="success">Active</Badge>
                ) : (
                  <Badge variant="danger">Deactivated</Badge>
                )}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {student.grade} · joined {formatDate(student.createdAt)}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 sm:gap-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Reports
              </p>
              <p className="mt-1 text-2xl font-extrabold tabular text-foreground">
                {reports.length}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Avg. progress
              </p>
              <p className="mt-1 text-2xl font-extrabold tabular text-foreground">
                {averageIndex >= 0 ? PROGRESS_RATINGS[Math.round(averageIndex)] : "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border bg-background/60 px-6 py-4">
          {subjects.length ? (
            subjects.map((subject) => (
              <Badge key={subject} variant="primary">
                {subject}
              </Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No subjects assigned yet — assign this student to a tutor to start reports.
            </p>
          )}
        </div>
      </Card>

      {/* Timeline */}
      <section aria-labelledby="timeline-heading">
        <h2 id="timeline-heading" className="text-base font-bold tracking-tight">
          Monthly report history
        </h2>

        {reports.length === 0 ? (
          <Card className="mt-4">
            <EmptyState
              icon={<CalendarX2 className="size-6" aria-hidden />}
              title="No reports yet"
              description={`Reports appear here once a tutor submits the first month for ${student.fullName}.`}
              action={
                <Button asChild variant="outline">
                  <Link href="/admin/assignments">Assign a tutor</Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <ol className="mt-4 space-y-3">
            {reports.map((report) => (
              <li key={report.id}>
                <Card className="p-5 transition-shadow hover:shadow-card-hover">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      {/* Timeline dot + line */}
                      <div className="flex flex-col items-center">
                        <span
                          className={cn(
                            "size-3.5 shrink-0 rounded-full ring-4",
                            report.status === "reviewed"
                              ? "bg-success ring-success-soft"
                              : report.status === "needs_revision"
                                ? "bg-danger ring-danger-soft"
                                : report.status === "draft"
                                  ? "bg-warning ring-warning-soft"
                                  : "bg-primary ring-primary-soft",
                          )}
                          aria-hidden
                        />
                      </div>

                      <div className="min-w-0">
                        <p className="text-base font-bold tracking-tight">
                          {formatMonth(report.month)}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {report.subject} · {report.instructorName}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <RatingBadge rating={report.progressRating} />
                      <StatusBadge status={report.status} />
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/reports/${report.id}`}>
                          Open report
                          <ArrowUpRight aria-hidden />
                        </Link>
                      </Button>
                    </div>
                  </div>

                  <p className="mt-4 line-clamp-2 border-l-2 border-primary-soft pl-4 text-sm leading-relaxed text-muted-foreground">
                    {report.generalFeedback || "No feedback recorded."}
                  </p>

                  <p className="mt-3 text-xs text-muted-foreground">
                    {report.submittedAt
                      ? `Submitted ${formatDate(report.submittedAt)}`
                      : `Last edited ${formatDate(report.updatedAt)}`}
                    {report.continuityNeeded ? " · continuity required next month" : ""}
                  </p>
                </Card>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function parentLink(phone: string, studentName: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const month = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const message = messages.parentReportReady({
    parentName: "",
    studentName,
    month,
  });
  const normalised = phone.replace(/\D/g, "");
  const full = normalised.startsWith("234")
    ? normalised
    : `234${normalised.replace(/^0/, "")}`;
  return `https://wa.me/${full || "2348012345678"}?text=${encodeURIComponent(
    `${message}\nOpen your reports: ${origin}/parent`,
  )}`;
}