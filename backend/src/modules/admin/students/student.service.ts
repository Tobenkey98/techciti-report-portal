import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import { conflict, notFound } from "../../../lib/errors.js";
import { getPagination, paginated } from "../../../lib/pagination.js";
import { toStudentView } from "../../../lib/serialize.js";
import { COMPLETED_REPORT_STATUSES, PROGRESS_RATINGS } from "../../../config/constants.js";
import type { createStudentSchema, listStudentsQuerySchema, updateStudentSchema } from "./student.schema.js";

type CreateBody = z.infer<typeof createStudentSchema>;
type UpdateBody = z.infer<typeof updateStudentSchema>;
type ListQuery = z.infer<typeof listStudentsQuerySchema>;

function searchFilter(search?: string): Prisma.StudentWhereInput {
  if (!search) return {};
  return {
    OR: [
      { fullName: { contains: search } },
      { parentName: { contains: search } },
      { parentPhone: { contains: search } },
    ],
  };
}

export async function listStudents(query: ListQuery) {
  const pagination = getPagination(query);

  const where: Prisma.StudentWhereInput = {
    ...searchFilter(query.search),
    ...(query.ageGroup !== "all" ? { ageGroup: query.ageGroup } : {}),
    ...(query.status === "active" ? { isActive: true } : {}),
    ...(query.status === "inactive" ? { isActive: false } : {}),
    // Filter by course/tutor through the assignment relation so the student
    // list can answer "who is taking Python with Amaka?".
    ...(query.courseId || query.tutorId
      ? {
          assignments: {
            some: {
              isActive: true,
              ...(query.courseId ? { courseId: query.courseId } : {}),
              ...(query.tutorId ? { tutorId: query.tutorId } : {}),
            },
          },
        }
      : {}),
  };

  const orderBy: Prisma.StudentOrderByWithRelationInput =
    query.sort === "createdAt" ? { createdAt: query.direction } : { fullName: query.direction };

  const [rows, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: {
        assignments: {
          where: { isActive: true },
          select: {
            id: true,
            level: true,
            tutor: { select: { id: true, fullName: true } },
            course: { select: { id: true, name: true } },
          },
        },
      },
      orderBy,
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.student.count({ where }),
  ]);

  const result = paginated(rows, total, pagination);
  return {
    ...result,
    rows: result.rows.map((student) => ({
      ...toStudentView(student),
      courseCount: student.assignments.length,
      tutors: [...new Set(student.assignments.map((a) => a.tutor.fullName))],
      courses: [...new Set(student.assignments.map((a) => a.course.name))],
    })),
  };
}

export async function getStudent(id: string) {
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      assignments: {
        where: { isActive: true },
        include: {
          tutor: { select: { id: true, fullName: true } },
          course: { select: { id: true, name: true, category: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!student) throw notFound("Student not found.");

  return {
    ...toStudentView(student),
    assignments: student.assignments.map((assignment) => ({
      id: assignment.id,
      level: assignment.level,
      tutor: assignment.tutor,
      course: assignment.course,
    })),
  };
}

/**
 * Everything the admin app's student-profile screen needs: the student, their
 * courses/tutors, and a month-by-month report timeline.
 */
export async function getStudentProfile(id: string) {
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      assignments: {
        where: { isActive: true },
        include: {
          tutor: { select: { id: true, fullName: true } },
          course: { select: { id: true, name: true, category: true } },
          reports: { orderBy: { month: "desc" } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!student) throw notFound("Student not found.");

  const reports = student.assignments.flatMap((assignment) =>
    assignment.reports.map((report) => ({
      id: report.id,
      month: report.month,
      status: report.status,
      progressRating: report.progressRating,
      submittedAt: report.submittedAt ? report.submittedAt.toISOString() : null,
      reviewedAt: report.reviewedAt ? report.reviewedAt.toISOString() : null,
      generalFeedback: report.generalFeedback,
      tutorComment: report.tutorComment,
      assignmentId: assignment.id,
      level: assignment.level,
      tutor: assignment.tutor,
      course: assignment.course,
    })),
  );

  // Timeline is newest first across all courses.
  reports.sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0));

  const rated = reports.filter((r) => r.progressRating);
  const averageRating = rated.length
    ? Number(
        (
          rated.reduce((total, r) => total + (PROGRESS_RATINGS.indexOf(r.progressRating!) + 1), 0) /
          rated.length
        ).toFixed(2),
      )
    : null;

  return {
    student: toStudentView(student),
    assignments: student.assignments.map((assignment) => ({
      id: assignment.id,
      level: assignment.level,
      tutor: assignment.tutor,
      course: assignment.course,
      reportCount: assignment.reports.length,
    })),
    reports,
    summary: {
      totalReports: reports.length,
      submitted: reports.filter((r) => (COMPLETED_REPORT_STATUSES as readonly string[]).includes(r.status)).length,
      needsRevision: reports.filter((r) => r.status === "NEEDS_REVISION").length,
      averageRating,
    },
  };
}

export async function createStudent(body: CreateBody) {
  const student = await prisma.student.create({
    data: {
      fullName: body.fullName,
      ageGroup: body.ageGroup,
      parentName: body.parentName ?? null,
      parentPhone: body.parentPhone ?? null,
      parentEmail: body.parentEmail ?? null,
    },
  });
  return toStudentView(student);
}

export async function updateStudent(id: string, body: UpdateBody) {
  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing) throw notFound("Student not found.");

  const student = await prisma.student.update({
    where: { id },
    data: {
      ...(body.fullName !== undefined ? { fullName: body.fullName } : {}),
      ...(body.ageGroup !== undefined ? { ageGroup: body.ageGroup } : {}),
      ...(body.parentName !== undefined ? { parentName: body.parentName } : {}),
      ...(body.parentPhone !== undefined ? { parentPhone: body.parentPhone } : {}),
      ...(body.parentEmail !== undefined ? { parentEmail: body.parentEmail } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
  });
  return toStudentView(student);
}

export async function setStudentActive(id: string, isActive: boolean) {
  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing) throw notFound("Student not found.");

  const student = await prisma.student.update({ where: { id }, data: { isActive } });
  return toStudentView(student);
}

export async function deleteStudent(id: string) {
  const student = await prisma.student.findUnique({
    where: { id },
    include: { _count: { select: { assignments: true } } },
  });
  if (!student) throw notFound("Student not found.");

  const reports = await prisma.report.count({ where: { assignment: { studentId: id } } });
  if (reports > 0) {
    throw conflict(
      `This student has ${reports} report(s) and cannot be deleted. Deactivate them instead to keep the history.`,
    );
  }

  await prisma.student.delete({ where: { id } });
  return { id, deleted: true };
}