import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import { badRequest, conflict, notFound } from "../../../lib/errors.js";
import { getPagination, paginated } from "../../../lib/pagination.js";
import { toAssignmentWithRefs } from "../../../lib/serialize.js";
import type {
  createAssignmentSchema,
  listAssignmentsQuerySchema,
  updateAssignmentSchema,
} from "./assignment.schema.js";

type CreateBody = z.infer<typeof createAssignmentSchema>;
type UpdateBody = z.infer<typeof updateAssignmentSchema>;
type ListQuery = z.infer<typeof listAssignmentsQuerySchema>;

const withRefs = {
  tutor: { select: { id: true, fullName: true, email: true, phone: true } },
  student: { select: { id: true, fullName: true, ageGroup: true, parentName: true, parentPhone: true } },
  course: { select: { id: true, name: true, category: true } },
} satisfies Prisma.AssignmentInclude;

export async function listAssignments(query: ListQuery) {
  const pagination = getPagination(query);

  const where: Prisma.AssignmentWhereInput = {
    ...(query.tutorId ? { tutorId: query.tutorId } : {}),
    ...(query.studentId ? { studentId: query.studentId } : {}),
    ...(query.courseId ? { courseId: query.courseId } : {}),
    ...(query.level !== "all" ? { level: query.level } : {}),
    ...(query.status === "active" ? { isActive: true } : {}),
    ...(query.status === "inactive" ? { isActive: false } : {}),
    ...(query.search
      ? {
          OR: [
            { student: { fullName: { contains: query.search } } },
            { tutor: { fullName: { contains: query.search } } },
            { course: { name: { contains: query.search } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.assignment.findMany({
      where,
      include: withRefs,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.assignment.count({ where }),
  ]);

  const result = paginated(rows, total, pagination);
  return { ...result, rows: result.rows.map(toAssignmentWithRefs) };
}

/** Confirms all three references exist and are active, with a readable error. */
async function assertReferences(tutorId: string, studentId: string, courseId: string) {
  const [tutor, student, course] = await Promise.all([
    prisma.tutor.findUnique({ where: { id: tutorId }, select: { id: true, fullName: true, isActive: true } }),
    prisma.student.findUnique({ where: { id: studentId }, select: { id: true, fullName: true, isActive: true } }),
    prisma.course.findUnique({ where: { id: courseId }, select: { id: true, name: true, isActive: true } }),
  ]);

  if (!tutor) throw badRequest("That tutor does not exist.", { tutorId: "Unknown tutor." });
  if (!student) throw badRequest("That student does not exist.", { studentId: "Unknown student." });
  if (!course) throw badRequest("That course does not exist.", { courseId: "Unknown course." });

  const details: Record<string, string> = {};
  if (!tutor.isActive) details.tutorId = "That tutor is deactivated.";
  if (!student.isActive) details.studentId = "That student is deactivated.";
  if (!course.isActive) details.courseId = "That course is deactivated.";

  if (Object.keys(details).length > 0) {
    throw badRequest("This assignment involves a deactivated record.", details);
  }

  return { tutor, student, course };
}

export async function createAssignment(body: CreateBody) {
  await assertReferences(body.tutorId, body.studentId, body.courseId);

  // Duplicate check gives a friendly message; the unique index is the real guard.
  const existing = await prisma.assignment.findUnique({
    where: {
      assignment_tutor_student_course: {
        tutorId: body.tutorId,
        studentId: body.studentId,
        courseId: body.courseId,
      },
    },
    select: { id: true, isActive: true },
  });

  if (existing) {
    if (existing.isActive) {
      throw conflict("This tutor already teaches that course to that student.", {
        courseId: "Already assigned.",
      });
    }
    // A soft-deleted row exists — reactivate it rather than fighting the index.
    const revived = await prisma.assignment.update({
      where: { id: existing.id },
      data: { isActive: true, level: body.level },
      include: withRefs,
    });
    return toAssignmentWithRefs(revived);
  }

  const assignment = await prisma.assignment.create({
    data: body,
    include: withRefs,
  });
  return toAssignmentWithRefs(assignment);
}

export async function updateAssignment(id: string, body: UpdateBody) {
  const existing = await prisma.assignment.findUnique({ where: { id } });
  if (!existing) throw notFound("Assignment not found.");

  const next = {
    tutorId: body.tutorId ?? existing.tutorId,
    studentId: body.studentId ?? existing.studentId,
    courseId: body.courseId ?? existing.courseId,
  };
  await assertReferences(next.tutorId, next.studentId, next.courseId);

  const changed =
    next.tutorId !== existing.tutorId ||
    next.studentId !== existing.studentId ||
    next.courseId !== existing.courseId;

  if (changed) {
    const clash = await prisma.assignment.findUnique({
      where: {
        assignment_tutor_student_course: {
          tutorId: next.tutorId,
          studentId: next.studentId,
          courseId: next.courseId,
        },
      },
      select: { id: true },
    });
    if (clash && clash.id !== id) {
      throw conflict("Another assignment already links that tutor, student and course.", {
        courseId: "Already assigned.",
      });
    }
  }

  const assignment = await prisma.assignment.update({
    where: { id },
    data: {
      ...(body.tutorId !== undefined ? { tutorId: body.tutorId } : {}),
      ...(body.studentId !== undefined ? { studentId: body.studentId } : {}),
      ...(body.courseId !== undefined ? { courseId: body.courseId } : {}),
      ...(body.level !== undefined ? { level: body.level } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
    include: withRefs,
  });
  return toAssignmentWithRefs(assignment);
}

export async function setAssignmentActive(id: string, isActive: boolean) {
  const existing = await prisma.assignment.findUnique({ where: { id } });
  if (!existing) throw notFound("Assignment not found.");

  const assignment = await prisma.assignment.update({
    where: { id },
    data: { isActive },
    include: withRefs,
  });
  return toAssignmentWithRefs(assignment);
}

/**
 * Assignments are soft-deleted: reports reference them and must survive, so the
 * row is deactivated rather than removed.
 */
export async function deleteAssignment(id: string) {
  const existing = await prisma.assignment.findUnique({ where: { id } });
  if (!existing) throw notFound("Assignment not found.");

  await prisma.assignment.update({ where: { id }, data: { isActive: false } });
  return { id, deleted: true, softDeleted: true };
}