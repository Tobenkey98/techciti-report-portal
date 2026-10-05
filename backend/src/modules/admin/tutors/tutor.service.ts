import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import { conflict, notFound } from "../../../lib/errors.js";
import { generateTutorToken } from "../../../lib/crypto.js";
import { getPagination, paginated } from "../../../lib/pagination.js";
import { toTutorView } from "../../../lib/serialize.js";
import { tutorLinkInvite, tutorPortalUrl, tutorReminder, whatsappLink } from "../../../lib/whatsapp.js";
import { currentMonth, formatMonth } from "../../../lib/month.js";
import type { createTutorSchema, listTutorsQuerySchema, updateTutorSchema } from "./tutor.schema.js";

type CreateBody = z.infer<typeof createTutorSchema>;
type UpdateBody = z.infer<typeof updateTutorSchema>;
type ListQuery = z.infer<typeof listTutorsQuerySchema>;

/**
 * Reports hang off assignments, not off tutors directly, so a tutor's report
 * count needs its own aggregation rather than a `_count` include.
 */
async function tutorReportCount(tutorId: string): Promise<number> {
  return prisma.report.count({ where: { assignment: { tutorId } } });
}

/**
 * Report counts for many tutors at once. Two flat queries (assignments, then
 * reports for those assignments) rather than one aggregate per tutor.
 */
async function reportCountsForTutors(tutorIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (tutorIds.length === 0) return counts;

  const assignments = await prisma.assignment.findMany({
    where: { tutorId: { in: tutorIds } },
    select: { id: true, tutorId: true },
  });

  const reports = await prisma.report.findMany({
    where: { assignmentId: { in: assignments.map((assignment) => assignment.id) } },
    select: { assignmentId: true },
  });

  const tutorByAssignment = new Map(assignments.map((assignment) => [assignment.id, assignment.tutorId]));
  for (const report of reports) {
    const tutorId = tutorByAssignment.get(report.assignmentId);
    if (tutorId) counts.set(tutorId, (counts.get(tutorId) ?? 0) + 1);
  }

  return counts;
}

const withCounts = {
  _count: { select: { assignments: true } },
} satisfies Prisma.TutorInclude;

/** Search across name, email and phone with a single case-insensitive OR. */
function searchFilter(search?: string): Prisma.TutorWhereInput {
  if (!search) return {};
  return {
    OR: [
      { fullName: { contains: search } },
      { email: { contains: search } },
      { phone: { contains: search } },
    ],
  };
}

export async function listTutors(query: ListQuery) {
  const pagination = getPagination(query);
  const where: Prisma.TutorWhereInput = {
    ...searchFilter(query.search),
    ...(query.status === "active" ? { isActive: true } : {}),
    ...(query.status === "inactive" ? { isActive: false } : {}),
  };

  const orderBy: Prisma.TutorOrderByWithRelationInput =
    query.sort === "createdAt" ? { createdAt: query.direction } : { fullName: query.direction };

  const [rows, total] = await Promise.all([
    prisma.tutor.findMany({
      where,
      include: withCounts,
      orderBy,
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.tutor.count({ where }),
  ]);

  const result = paginated(rows, total, pagination);

  // Report counts for the whole page in two queries, instead of N+1 aggregates.
  const reportCountByTutor = await reportCountsForTutors(rows.map((row) => row.id));

  return {
    ...result,
    rows: result.rows.map((tutor) => ({
      ...toTutorView(tutor),
      assignmentCount: tutor._count.assignments,
      reportCount: reportCountByTutor.get(tutor.id) ?? 0,
    })),
  };
}

export async function getTutor(id: string) {
  const tutor = await prisma.tutor.findUnique({
    where: { id },
    include: {
      ...withCounts,
      assignments: {
        where: { isActive: true },
        include: {
          student: { select: { id: true, fullName: true, ageGroup: true } },
          course: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!tutor) throw notFound("Tutor not found.");

  return {
    ...toTutorView(tutor, true),
    assignmentCount: tutor._count.assignments,
    reportCount: await tutorReportCount(tutor.id),
    assignments: tutor.assignments.map((assignment) => ({
      id: assignment.id,
      level: assignment.level,
      student: assignment.student,
      course: assignment.course,
    })),
  };
}

/** Creates a tutor together with their brand-new private portal token. */
export async function createTutor(body: CreateBody) {
  if (body.email) {
    const existing = await prisma.tutor.findUnique({ where: { email: body.email } });
    if (existing) throw conflict("A tutor with that email already exists.", { email: "Already in use." });
  }

  const accessToken = generateTutorToken();

  const tutor = await prisma.tutor.create({
    data: {
      fullName: body.fullName,
      email: body.email ?? null,
      phone: body.phone,
      accessToken,
    },
    include: withCounts,
  });

  const url = tutorPortalUrl(tutor.accessToken);
  return {
    ...toTutorView(tutor, true),
    assignmentCount: tutor._count.assignments,
    reportCount: await tutorReportCount(tutor.id),
    portalUrl: url,
    shareLink: whatsappLink(tutor.phone, tutorLinkInvite(tutor.fullName, url, currentMonth())),
  };
}

export async function updateTutor(id: string, body: UpdateBody) {
  const existing = await prisma.tutor.findUnique({ where: { id } });
  if (!existing) throw notFound("Tutor not found.");

  if (body.email && body.email !== existing.email) {
    const clash = await prisma.tutor.findUnique({ where: { email: body.email } });
    if (clash) throw conflict("A tutor with that email already exists.", { email: "Already in use." });
  }

  const tutor = await prisma.tutor.update({
    where: { id },
    data: {
      ...(body.fullName !== undefined ? { fullName: body.fullName } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
    include: withCounts,
  });

  return {
    ...toTutorView(tutor),
    assignmentCount: tutor._count.assignments,
    reportCount: await tutorReportCount(tutor.id),
  };
}

export async function setTutorActive(id: string, isActive: boolean) {
  const existing = await prisma.tutor.findUnique({ where: { id } });
  if (!existing) throw notFound("Tutor not found.");

  const tutor = await prisma.tutor.update({
    where: { id },
    data: {
      isActive,
      // Deactivating revokes the portal token so the private link stops working
      // immediately. Reactivating clears the revocation and restores the same
      // link, which is what an admin undoing a mistake expects.
      ...(isActive ? { tokenRevokedAt: null } : { tokenRevokedAt: new Date() }),
    },
    include: withCounts,
  });

  return {
    ...toTutorView(tutor),
    assignmentCount: tutor._count.assignments,
    reportCount: await tutorReportCount(tutor.id),
  };
}

/**
 * Issues a fresh portal token.
 *
 * The previous link stops working the moment this returns, because the old
 * token no longer exists in the `tutors` table — `requireTutor` looks the token
 * up by exact match on every request. `tokenRevokedAt` is deliberately left
 * untouched here: it describes *the stored token*, and the stored token is
 * about to be a brand-new, valid one. Setting it would make the freshly issued
 * link dead on arrival.
 */
export async function regenerateLink(id: string) {
  const existing = await prisma.tutor.findUnique({ where: { id } });
  if (!existing) throw notFound("Tutor not found.");

  const accessToken = generateTutorToken();
  const tutor = await prisma.tutor.update({
    where: { id },
    data: { accessToken, tokenRevokedAt: null },
    include: withCounts,
  });

  const url = tutorPortalUrl(tutor.accessToken);
  return {
    ...toTutorView(tutor, true),
    assignmentCount: tutor._count.assignments,
    reportCount: await tutorReportCount(tutor.id),
    portalUrl: url,
    shareLink: whatsappLink(tutor.phone, tutorLinkInvite(tutor.fullName, url, currentMonth())),
  };
}

/**
 * The shareable portal link plus a ready-to-send WhatsApp message.
 * Also reports how many reports are still outstanding, so the admin can send a
 * reminder instead of an invitation when appropriate.
 */
export async function getLink(id: string, month?: string) {
  const tutor = await prisma.tutor.findUnique({
    where: { id },
    include: { assignments: { where: { isActive: true }, select: { id: true } } },
  });
  if (!tutor) throw notFound("Tutor not found.");

  const targetMonth = month ?? currentMonth();
  const assignmentIds = tutor.assignments.map((assignment) => assignment.id);

  const outstanding = assignmentIds.length
    ? await prisma.report.count({
        where: {
          assignmentId: { in: assignmentIds },
          month: targetMonth,
          status: { in: ["SUBMITTED", "REVIEWED"] },
        },
      })
    : 0;

  const remaining = Math.max(0, assignmentIds.length - outstanding);
  const url = tutorPortalUrl(tutor.accessToken);

  const message =
    remaining > 0
      ? tutorReminder(tutor.fullName, url, targetMonth, remaining)
      : tutorLinkInvite(tutor.fullName, url, targetMonth);

  return {
    tutorId: tutor.id,
    fullName: tutor.fullName,
    accessToken: tutor.accessToken,
    portalUrl: url,
    whatsappLink: whatsappLink(tutor.phone, message),
    message,
    month: targetMonth,
    monthLabel: formatMonth(targetMonth),
    totals: { assignments: assignmentIds.length, submitted: outstanding, remaining },
  };
}

/**
 * Hard delete is only allowed while the tutor has no reports, so historical
 * monthly data is never silently destroyed. Use deactivation otherwise.
 */
export async function deleteTutor(id: string) {
  const tutor = await prisma.tutor.findUnique({
    where: { id },
    include: { _count: { select: { assignments: true } } },
  });
  if (!tutor) throw notFound("Tutor not found.");

  const reports = await tutorReportCount(id);
  if (reports > 0) {
    throw conflict(
      `This tutor has ${reports} report(s) and cannot be deleted. Deactivate them instead to keep the history.`,
    );
  }

  await prisma.tutor.delete({ where: { id } });
  return { id, deleted: true };
}