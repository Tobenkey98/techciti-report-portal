"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  ClipboardList,
  SlidersHorizontal,
} from "lucide-react";
import { MonthPicker } from "@/components/shared/month-picker";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { RatingBadge, StatusBadge } from "@/components/shared/status-badge";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SkeletonTable } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAsyncData } from "@/hooks/use-async-data";
import {
  courses as coursesApi,
  instructors as instructorsApi,
  reports as reportsApi,
  students as studentsApi,
} from "@/lib/api";
import { gradeGroups } from "@/lib/constants";
import type {
  Instructor,
  PaginatedResult,
  ReportQuery,
  ReportSortKey,
  ReportWithContext,
  SortDirection,
  Student,
} from "@/lib/types";
import { cn, formatMonth, getCurrentMonth, relativeTime } from "@/lib/utils";

const COLUMNS: { key: ReportSortKey | "actions"; label: string; sortable?: boolean; className?: string }[] = [
  { key: "studentName", label: "Student", sortable: true },
  { key: "subject", label: "Subject" },
  { key: "instructorName", label: "Tutor", sortable: true },
  { key: "month", label: "Month", sortable: true },
  { key: "progressRating", label: "Progress", sortable: true },
  { key: "status", label: "Status", sortable: true },
  { key: "submittedAt", label: "Submitted", sortable: true },
  { key: "actions", label: "", className: "text-right" },
];

export function ReportsView() {
  const [search, setSearch] = React.useState("");
  const [month, setMonth] = React.useState<string>(getCurrentMonth());
  const [tutorId, setTutorId] = React.useState("all");
  const [studentId, setStudentId] = React.useState("all");
  const [grade, setGrade] = React.useState("all");
  const [subject, setSubject] = React.useState("all");
  const [status, setStatus] = React.useState<ReportQuery["status"]>("all");
  const [sort, setSort] = React.useState<ReportSortKey>("updatedAt");
  const [direction, setDirection] = React.useState<SortDirection>("desc");
  const [page, setPage] = React.useState(1);

  const tutors = useAsyncData<Instructor[]>(() => instructorsApi.list(), []);
  const students = useAsyncData<Student[]>(() => studentsApi.list(), []);
  const courseList = useAsyncData(() => coursesApi.list(), []);
  const courseOptions = (courseList.data ?? []).filter((course) => course.isActive);

  const query = React.useMemo(
    () => ({
      search,
      month,
      instructorId: tutorId,
      studentId,
      grade,
      subject,
      status,
      sort,
      direction,
      page,
      pageSize: 10,
    }),
    [search, month, tutorId, studentId, grade, subject, status, sort, direction, page],
  );

  const { data, loading, refresh } = useAsyncData<PaginatedResult<ReportWithContext>>(
    () => reportsApi.list(query),
    [JSON.stringify(query)],
  );

  // Any filter change starts again from page one.
  React.useEffect(() => {
    setPage(1);
  }, [search, month, tutorId, studentId, grade, subject, status]);

  const filtersActive =
    search !== "" ||
    tutorId !== "all" ||
    studentId !== "all" ||
    grade !== "all" ||
    subject !== "all" ||
    status !== "all" ||
    month !== getCurrentMonth();

  function toggleSort(key: ReportSortKey) {
    if (sort === key) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setDirection("asc");
    }
  }

  function resetFilters() {
    setSearch("");
    setMonth(getCurrentMonth());
    setTutorId("all");
    setStudentId("all");
    setGrade("all");
    setSubject("all");
    setStatus("all");
  }

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Every monthly report submitted by tutors, with filters for month, tutor, student, grade, subject and status."
        actions={
          <MonthPicker
            value={month}
            onChange={setMonth}
            allowAll
            aria-label="Filter reports by month"
            months={18}
          />
        }
      />

      <Card className="overflow-hidden">
        {/* Filters */}
        <div className="space-y-3 border-b border-border p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search student, tutor, subject or feedback…"
              className="lg:max-w-md"
              aria-label="Search reports"
            />
            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              <span className="hidden items-center gap-1.5 text-sm font-semibold text-muted-foreground sm:flex">
                <SlidersHorizontal className="size-4" aria-hidden />
                Filters
              </span>

              <Select value={tutorId} onValueChange={setTutorId}>
                <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by tutor">
                  <SelectValue placeholder="All tutors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tutors</SelectItem>
                  {(tutors.data ?? []).map((tutor) => (
                    <SelectItem key={tutor.id} value={tutor.id}>
                      {tutor.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger className="w-full sm:w-[190px]" aria-label="Filter by student">
                  <SelectValue placeholder="All students" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All students</SelectItem>
                  {(students.data ?? []).map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger className="w-full sm:w-[140px]" aria-label="Filter by grade">
                  <SelectValue placeholder="All grades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All grades</SelectItem>
                  {gradeGroups().map((group) => (
                    <SelectGroup key={group.label}>
                      <SelectLabel>{group.label}</SelectLabel>
                      {group.grades.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>

              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger className="w-full sm:w-[170px]" aria-label="Filter by subject">
                  <SelectValue placeholder="All subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subjects</SelectItem>
                  {courseOptions.map((course) => (
                    <SelectItem key={course.id} value={course.name}>
                      {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={status}
                onValueChange={(value) => setStatus(value as ReportQuery["status"])}
              >
                <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filter by status">
                  <SelectValue placeholder="Any status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any status</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="needs_revision">Needs revision</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>

              {filtersActive ? (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  Reset
                </Button>
              ) : null}
            </div>
          </div>

          <p className="text-sm text-muted-foreground" aria-live="polite">
            {loading && !data
              ? "Loading reports…"
              : `${data?.total ?? 0} report${data?.total === 1 ? "" : "s"} ${
                  month === "all" ? "across all months" : `for ${formatMonth(month)}`
                }`}
          </p>
        </div>

        {loading && !data ? (
          <SkeletonTable rows={8} columns={7} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="size-6" aria-hidden />}
            title="No reports match these filters"
            description="Try a different month, or clear the filters to see everything submitted so far."
            action={
              <Button variant="outline" onClick={resetFilters}>
                Reset filters
              </Button>
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  {COLUMNS.map((column) => (
                    <TableHead
                      key={column.key}
                      className={cn(
                        column.key === "studentName" && "pl-5",
                        column.className,
                      )}
                      aria-sort={
                        column.sortable && sort === column.key
                          ? direction === "asc"
                            ? "ascending"
                            : "descending"
                          : column.sortable
                            ? "none"
                            : undefined
                      }
                    >
                      {column.sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(column.key as ReportSortKey)}
                          className="inline-flex items-center gap-1.5 rounded transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          {column.label}
                          {sort === column.key ? (
                            direction === "asc" ? (
                              <ArrowUp className="size-3.5 text-primary" aria-hidden />
                            ) : (
                              <ArrowDown className="size-3.5 text-primary" aria-hidden />
                            )
                          ) : (
                            <ArrowUpDown className="size-3 opacity-40" aria-hidden />
                          )}
                        </button>
                      ) : (
                        column.label
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="pl-5">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">
                          {report.studentName}
                        </p>
                        <p className="text-sm text-muted-foreground">{report.grade}</p>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{report.subject}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {report.instructorName}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatMonth(report.month)}
                    </TableCell>
                    <TableCell>
                      <RatingBadge rating={report.progressRating} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={report.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {report.submittedAt ? relativeTime(report.submittedAt) : "Not sent"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/reports/${report.id}`}>
                          Open
                          <ChevronRight aria-hidden />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {data ? (
              <Pagination
                page={data.page}
                pageCount={data.pageCount}
                total={data.total}
                pageSize={data.pageSize}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}
      </Card>
    </div>
  );
}