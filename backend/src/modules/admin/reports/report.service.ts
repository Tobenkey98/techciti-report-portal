import type { Prisma, ReportStatus } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import { badRequest, conflict, notFound } from "../../../lib/errors.js";
import { getPagination, paginated, parseDirection } from "../../../lib/pagination.js";
import { toReportWithContext } from "../../../lib/serialize.js";
import { currentMonth } from "../../../lib/month.js";
import { RATING_LABELS, STATUS_LABELS, LEVEL_LABELS, AGE_GROUP_LABELS } from "../../../config/constants.js";
import type { listReportsQuerySchema, requestRevisionBodySchema, reviewBodySchema } from "./report.schema.js";

type ListQuery = z.infer<typeof listReportsQuerySchema>;

export const reportInclude = {
  assignment: {
    select: {
      id: true,
      level: true,
      tutorId: true,
      studentId: true,
      courseId: true,
      tutor: { select: { id: true, fullName: true, email: true, phone: true } },
      student: {
        select: {
          id: true,
          fullName: true,
          ageGroup: true,
          parentName: true,
          parentPhone: true,
          parentEmail: true,
        },
      },
      course: { select: { id: true, name: true, category: true } },
    },
  },
  reviewedByAdmin: { select: { id: true, name: true } },
} satisfies Prisma.ReportInclude;

/** Maps the admin app's sort keys onto Prisma's nested order syntax. */
function orderBy(sort: ListQuery["sort"], direction: "asc" | "desc"): Prisma.ReportOrderByWithRelationInput[] {
  const dir = direction;
  switch (sort) {
    case "studentName":
      return [{ assignment: { student: { fullName: dir } } }];
    case "tutorName":
      return [{ assignment: { tutor: { fullName: dir } } }];
    case "courseName":
      return [{ assignment: { course: { name: dir } } }];
    case "month":
      return [{ month: dir }, { submittedAt: dir }];
    case "progressRating":
      return [{ progressRating: dir }];
    case "status":
      return [{ status: dir }];
    case "submittedAt":
    default:
      return [{ submittedAt: dir }, { month: dir }];
  }
}

export function buildWhere(query: Partial<ListQuery>): Prisma.ReportWhereInput {
  return {
    ...(query.month && query.month !== "all" ? { month: query.month } : {}),
    ...(query.status && query.status !== "all" ? { status: query.status } : {}),
    ...(query.progressRating && query.progressRating !== "all"
      ? { progressRating: query.progressRating }
      : {}),
    ...(query.tutorId ? { assignment: { tutorId: query.tutorId } } : {}),
    ...(query.studentId ? { assignment: { studentId: query.studentId } } : {}),
    ...(query.courseId ? { assignment: { courseId: query.courseId } } : {}),
    ...(query.level && query.level !== "all" ? { assignment: { level: query.level } } : {}),
    ...(query.ageGroup && query.ageGroup !== "all"
      ? { assignment: { student: { ageGroup: query.ageGroup } } }
      : {}),
    ...(query.search
      ? {
          OR: [
            { topicsCovered: { contains: query.search } },
            { generalFeedback: { contains: query.search } },
            { tutorComment: { contains: query.search } },
            { assignment: { student: { fullName: { contains: query.search } } } },
            { assignment: { tutor: { fullName: { contains: query.search } } } },
            { assignment: { course: { name: { contains: query.search } } } },
          ],
        }
      : {}),
  };
}

export async function listReports(query: ListQuery) {
  const pagination = getPagination(query);
  const where = buildWhere(query);
  const direction = parseDirection(query.direction);

  const [rows, total] = await Promise.all([
    prisma.report.findMany({
      where,
      include: reportInclude,
      orderBy: orderBy(query.sort, direction),
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.report.count({ where }),
  ]);

  const result = paginated(rows, total, pagination);

  return {
    ...result,
    rows: result.rows.map((report) => {
      const view = toReportWithContext(report);
      return {
        ...view,
        statusLabel: STATUS_LABELS[report.status] ?? report.status,
        ratingLabel: report.progressRating ? RATING_LABELS[report.progressRating] : null,
        levelLabel: LEVEL_LABELS[view.level] ?? view.level,
        ageGroupLabel: AGE_GROUP_LABELS[view.student.ageGroup] ?? view.student.ageGroup,
      };
    }),
  };
}

/** Unpaginated variant used by the Excel export. */
export async function listAllForExport(query: ListQuery, limit = 5000) {
  const where = buildWhere(query);
  const rows = await prisma.report.findMany({
    where,
    include: reportInclude,
    orderBy: [{ month: "desc" }, { submittedAt: "desc" }],
    take: limit,
  });
  return rows.map((report) => toReportWithContext(report));
}

export async function getReport(id: string) {
  const report = await prisma.report.findUnique({ where: { id }, include: reportInclude });
  if (!report) throw notFound("Report not found.");

  const view = toReportWithContext(report);
  return {
    ...view,
    statusLabel: STATUS_LABELS[report.status] ?? report.status,
    ratingLabel: report.progressRating ? RATING_LABELS[report.progressRating] : null,
    levelLabel: LEVEL_LABELS[view.level] ?? view.level,
    ageGroupLabel: AGE_GROUP_LABELS[view.student.ageGroup] ?? view.student.ageGroup,
  };
}

/**
 * Marks a report as reviewed.
 * Only SUBMITTED and NEEDS_REVISION reports can be reviewed; a DRAFT has not
 * been submitted yet and a REVIEWED report is already final.
 */
export async function markReviewed(
  id: string,
  body: z.infer<typeof reviewBodySchema>,
  adminId: string,
) {
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) throw notFound("Report not found.");

  if (report.status === "DRAFT") {
    throw conflict("This report has not been submitted yet, so there is nothing to review.");
  }
  if (report.status === "REVIEWED") {
    throw conflict("This report has already been reviewed.");
  }

  const updated = await prisma.report.update({
    where: { id },
    data: {
      status: "REVIEWED",
      reviewedAt: new Date(),
      reviewedByAdminId: adminId,
      // An optional reviewer note is stored as the revision note so it shows on
      // the report; a requested revision replaces it later.
      revisionNote: body.note ?? null,
    },
    include: reportInclude,
  });

  return toReportWithContext(updated);
}

/** Sends a report back to the tutor with a required note. */
export async function requestRevision(id: string, body: z.infer<typeof requestRevisionBodySchema>) {
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) throw notFound("Report not found.");

  if (report.status === "DRAFT") {
    throw badRequest("This report has not been submitted yet, so there is nothing to send back.");
  }
  if (report.status === "NEEDS_REVISION") {
    throw conflict("A revision has already been requested on this report.");
  }

  const updated = await prisma.report.update({
    where: { id },
    data: {
      status: "NEEDS_REVISION",
      revisionNote: body.note,
      // Clear the review stamp: the report is back with the tutor.
      reviewedAt: null,
      reviewedByAdminId: null,
    },
    include: reportInclude,
  });

  return toReportWithContext(updated);
}

/** Reopens a reviewed report back to the tutor. */
export async function reopenReport(id: string, note: string) {
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) throw notFound("Report not found.");
  if (report.status !== "REVIEWED") {
    throw conflict("Only a reviewed report can be reopened.");
  }

  const updated = await prisma.report.update({
    where: { id },
    data: { status: "NEEDS_REVISION", revisionNote: note, reviewedAt: null, reviewedByAdminId: null },
    include: reportInclude,
  });
  return toReportWithContext(updated);
}

/** Status counts for a month, used by the dashboard and the reports filter bar. */
export async function statusCounts(month?: string) {
  const target = month ?? currentMonth();
  const grouped = await prisma.report.groupBy({
    by: ["status"],
    where: { month: target },
    _count: { _all: true },
  });

  const counts: Record<ReportStatus | "NOT_STARTED", number> = {
    DRAFT: 0,
    SUBMITTED: 0,
    REVIEWED: 0,
    NEEDS_REVISION: 0,
    NOT_STARTED: 0,
  };
  for (const row of grouped) counts[row.status] = row._count._all;

  const expected = await prisma.assignment.count({ where: { isActive: true } });
  counts.NOT_STARTED = Math.max(0, expected - (counts.SUBMITTED + counts.REVIEWED + counts.DRAFT + counts.NEEDS_REVISION));

  return { month: target, counts, expected };
}

/** Audit trail for a single report. */
export async function reportActivity(id: string) {
  const logs = await prisma.activityLog.findMany({
    where: { entityType: "report", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return logs;
}