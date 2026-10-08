import type { Prisma, ReportStatus } from "@prisma/client";
import type { DraftBody, SubmitBody } from "./tutor.schema.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError, conflict, forbidden, notFound } from "../../lib/errors.js";
import { resolveMonth } from "../../lib/month.js";
import type { TutorCardStatus } from "@prisma/client";
import { toReportView, toTutorSelfView } from "../../lib/serialize.js";
import type { ReportView } from "../../lib/serialize.js";

/** Assignment include used everywhere in the tutor portal. */
const assignmentWithRefs = {
  student: {
    select: {
      id: true,
      fullName: true,
      ageGroup: true,
      parentName: true,
      parentPhone: true,
    },
  },
  course: { select: { id: true, name: true, category: true } },
} satisfies Prisma.AssignmentInclude;

export interface TutorCard {
  assignmentId: string;
  studentId: string;
  studentName: string;
  ageGroup: "KIDS" | "TEENS" | "ADULTS";
  parentName: string | null;
  courseId: string;
  courseName: string;
  courseCategory: string;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  levelLabel: string;
  status: TutorCardStatus;
  reportId: string | null;
  progressRating: ReportView["progressRating"];
  submittedAt: string | null;
  updatedAt: string | null;
  revisionNote: string | null;
  /** The full report for this assignment/month, or null when none exists yet. */
  report: ReportView | null;
}

export interface TutorAssignmentsResult {
  month: string;
  tutor: ReturnType<typeof toTutorSelfView>;
  students: TutorCard[];
  summary: {
    total: number;
    submitted: number;
    inProgress: number;
    notStarted: number;
    needsRevision: number;
  };
}

const LEVEL_LABELS: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

/** Maps a stored report (or its absence) to the badge shown on a student card. */
function deriveCardStatus(report: { status: ReportStatus } | undefined): TutorCardStatus {
  if (!report) return "NOT_STARTED";
  if (report.status === "DRAFT") return "DRAFT";
  if (report.status === "NEEDS_REVISION") return "NEEDS_REVISION";
  return report.status;
}

/* -------------------------------------------------------------------------- */
/*                                    Reads                                   */
/* -------------------------------------------------------------------------- */

export function getMe(tutorId: string) {
  const tutor = prisma.tutor.findUnique({
    where: { id: tutorId },
    select: { id: true, fullName: true, email: true, isActive: true },
  });
  return tutor.then((row) => {
    if (!row) throw notFound("Tutor not found.");
    return toTutorSelfView(row);
  });
}

/**
 * The tutor's student list for a month, with each student's report status and
 * the counts the progress bar needs.
 */
export async function listAssignments(tutorId: string, rawMonth?: string): Promise<TutorAssignmentsResult> {
  const month = resolveMonth(rawMonth);
  const tutor = await prisma.tutor.findUnique({
    where: { id: tutorId },
    select: { id: true, fullName: true, email: true, isActive: true },
  });
  if (!tutor) throw notFound("Tutor not found.");

  const assignments = await prisma.assignment.findMany({
    where: { tutorId, isActive: true },
    include: {
      ...assignmentWithRefs,
      // The whole report is selected, not just its status: the tutor portal
      // seeds its report form from this list, so the draft body has to arrive
      // with the card. Truncating it here would force the portal into an N+1
      // fetch, one call per student, purely to fill in a form.
      reports: { where: { month } },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  const students: TutorCard[] = assignments.map((assignment) => {
    const report = assignment.reports[0];
    const view = report ? toReportView(report) : null;
    return {
      assignmentId: assignment.id,
      studentId: assignment.studentId,
      studentName: assignment.student.fullName,
      ageGroup: assignment.student.ageGroup,
      parentName: assignment.student.parentName,
      courseId: assignment.courseId,
      courseName: assignment.course.name,
      courseCategory: assignment.course.category,
      level: assignment.level,
      levelLabel: LEVEL_LABELS[assignment.level] ?? assignment.level,
      status: deriveCardStatus(report),
      reportId: report?.id ?? null,
      progressRating: report?.progressRating ?? null,
      submittedAt: view?.submittedAt ?? null,
      updatedAt: view?.updatedAt ?? null,
      revisionNote: report?.revisionNote ?? null,
      report: view,
    };
  });

  const summary = {
    total: students.length,
    submitted: students.filter((card) => card.status === "SUBMITTED" || card.status === "REVIEWED").length,
    inProgress: students.filter((card) => card.status === "DRAFT").length,
    notStarted: students.filter((card) => card.status === "NOT_STARTED").length,
    needsRevision: students.filter((card) => card.status === "NEEDS_REVISION").length,
  };

  return { month, tutor: toTutorSelfView(tutor), students, summary };
}

/**
 * The existing report or draft for an assignment/month pair.
 * Returns `null` rather than throwing when nothing exists yet, so the drawer
 * can open on a blank form.
 */
export async function getReport(
  tutorId: string,
  assignmentId: string,
  rawMonth?: string,
): Promise<{ month: string; report: ReportView | null }> {
  const month = resolveMonth(rawMonth);

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, tutorId, isActive: true },
    select: { id: true },
  });
  if (!assignment) throw notFound("That assignment is not on your list.");

  const report = await prisma.report.findUnique({
    where: { report_assignment_month: { assignmentId, month } },
  });

  return { month, report: report ? toReportView(report) : null };
}

/**
 * The most recent report *before* the given month, for "Copy from last month".
 * Returns null when this is the tutor's first month.
 */
export async function getPreviousReport(
  tutorId: string,
  assignmentId: string,
  rawMonth?: string,
): Promise<{ month: string; report: (ReportView & { month: string }) | null }> {
  const month = resolveMonth(rawMonth);

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, tutorId, isActive: true },
    select: { id: true },
  });
  if (!assignment) throw notFound("That assignment is not on your list.");

  // `lt` on the CHAR(7) "YYYY-MM" column is a correct chronological comparison
  // because the format sorts lexicographically.
  const previous = await prisma.report.findFirst({
    where: { assignmentId, month: { lt: month }, status: { in: ["SUBMITTED", "REVIEWED"] } },
    orderBy: { month: "desc" },
  });

  return { month, report: previous ? toReportView(previous) : null };
}

/* -------------------------------------------------------------------------- */
/*                                   Writes                                   */
/* -------------------------------------------------------------------------- */

/** A tutor may only write while the report is DRAFT, or NEEDS_REVISION. */
function assertEditable(report: { status: ReportStatus } | null | undefined, month: string): void {
  if (!report) return;
  if (report.status === "DRAFT" || report.status === "NEEDS_REVISION") return;

  const explanation =
    report.status === "REVIEWED"
      ? "This report has already been reviewed and can no longer be changed."
      : "This report has already been submitted and can no longer be changed.";

  throw forbidden(`${explanation} Ask your TechCiti admin if it needs to be reopened. (${month})`);
}

/**
 * Autosave. Upserts by `(assignmentId, month)`; the database unique index makes
 * a concurrent double-submit impossible.
 */
export async function saveDraft(
  tutorId: string,
  assignmentId: string,
  body: DraftBody,
): Promise<ReportView> {
  const month = resolveMonth(body.month);

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, tutorId, isActive: true },
    select: { id: true, studentId: true, courseId: true },
  });
  if (!assignment) throw notFound("That assignment is not on your list.");

  const existing = await prisma.report.findUnique({
    where: { report_assignment_month: { assignmentId, month } },
    select: { id: true, status: true },
  });

  assertEditable(existing, month);

  const payload = {
    topicsCovered: body.topicsCovered,
    continuityNeeded: body.continuityNeeded,
    continuityNote: body.continuityNote,
    generalFeedback: body.generalFeedback,
    tutorComment: body.tutorComment,
    progressRating: body.progressRating,
    sessionsHeld: body.sessionsHeld ?? null,
    sessionsAttended: body.sessionsAttended ?? null,
  };

  const report = await prisma.report.upsert({
    where: { report_assignment_month: { assignmentId, month } },
    create: {
      assignmentId,
      month,
      status: "DRAFT",
      ...payload,
    },
    update: {
      ...payload,
      // Saving over a NEEDS_REVISION report clears the reviewer note: the
      // tutor has addressed the feedback and is resubmitting.
      revisionNote: existing?.status === "NEEDS_REVISION" ? null : undefined,
      status: existing?.status === "NEEDS_REVISION" ? "DRAFT" : undefined,
    },
  });

  return toReportView(report);
}

/**
 * Submits a report for review.
 *
 * Rejects duplicates (the unique index and an explicit pre-check), rejects
 * reports already marked REVIEWED, and rejects future months.
 */
export async function submitReport(
  tutorId: string,
  assignmentId: string,
  body: SubmitBody,
): Promise<ReportView> {
  // `resolveMonth` is the single place that enforces "no future months", so a
  // future month is rejected here with the same 400 the autosave path returns.
  const month = resolveMonth(body.month);

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, tutorId, isActive: true },
    select: { id: true, studentId: true, courseId: true },
  });
  if (!assignment) throw notFound("That assignment is not on your list.");

  const existing = await prisma.report.findUnique({
    where: { report_assignment_month: { assignmentId, month } },
    select: { id: true, status: true },
  });

  if (existing) {
    if (existing.status === "REVIEWED") {
      throw new ApiError(
        "CONFLICT",
        "This report has already been reviewed and cannot be submitted again.",
        { meta: { status: existing.status } },
      );
    }
    if (existing.status === "SUBMITTED") {
      throw new ApiError(
        "DUPLICATE_REPORT",
        `A report for ${month} has already been submitted. Only one report is allowed per student per month.`,
        { meta: { status: existing.status, month } },
      );
    }
  }

  const nowIso = new Date();

  const report = await prisma.report.upsert({
    where: { report_assignment_month: { assignmentId, month } },
    create: {
      assignmentId,
      month,
      topicsCovered: body.topicsCovered,
      continuityNeeded: body.continuityNeeded,
      continuityNote: body.continuityNote,
      generalFeedback: body.generalFeedback,
      tutorComment: body.tutorComment,
      progressRating: body.progressRating,
      sessionsHeld: body.sessionsHeld ?? null,
      sessionsAttended: body.sessionsAttended ?? null,
      status: "SUBMITTED",
      submittedAt: nowIso,
      revisionNote: null,
    },
    update: {
      topicsCovered: body.topicsCovered,
      continuityNeeded: body.continuityNeeded,
      continuityNote: body.continuityNote,
      generalFeedback: body.generalFeedback,
      tutorComment: body.tutorComment,
      progressRating: body.progressRating,
      sessionsHeld: body.sessionsHeld ?? null,
      sessionsAttended: body.sessionsAttended ?? null,
      status: "SUBMITTED",
      submittedAt: nowIso,
      revisionNote: null,
    },
  });

  return toReportView(report);
}