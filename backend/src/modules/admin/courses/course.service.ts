import type { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.js";
import { conflict, notFound } from "../../../lib/errors.js";
import { toCourseView } from "../../../lib/serialize.js";
import { getPagination, paginated } from "../../../lib/pagination.js";
import type { z } from "zod";
import type { createCourseSchema, listCoursesQuerySchema, updateCourseSchema } from "./course.schema.js";

type CreateBody = z.infer<typeof createCourseSchema>;
type UpdateBody = z.infer<typeof updateCourseSchema>;
type ListQuery = z.infer<typeof listCoursesQuerySchema>;

/** Courses are a small, bounded list, so this returns everything. */
export async function listCourses(query: ListQuery) {
  const pagination = getPagination(query);

  const where: Prisma.CourseWhereInput = {
    ...(query.search
      ? { OR: [{ name: { contains: query.search } }, { category: { contains: query.search } }] }
      : {}),
    ...(query.status === "active" ? { isActive: true } : {}),
    ...(query.status === "inactive" ? { isActive: false } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.course.findMany({
      where,
      include: { _count: { select: { assignments: true } } },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.course.count({ where }),
  ]);

  const result = paginated(rows, total, pagination);
  return {
    ...result,
    rows: result.rows.map((course) => ({ ...toCourseView(course), assignmentCount: course._count.assignments })),
  };
}

export async function createCourse(body: CreateBody) {
  const existing = await prisma.course.findUnique({ where: { name: body.name } });
  if (existing) throw conflict("A course with that name already exists.", { name: "Already in use." });

  const course = await prisma.course.create({
    data: { name: body.name, category: body.category, isActive: body.isActive ?? true },
  });
  return toCourseView(course);
}

export async function updateCourse(id: string, body: UpdateBody) {
  const existing = await prisma.course.findUnique({ where: { id } });
  if (!existing) throw notFound("Course not found.");

  if (body.name && body.name !== existing.name) {
    const clash = await prisma.course.findUnique({ where: { name: body.name } });
    if (clash) throw conflict("A course with that name already exists.", { name: "Already in use." });
  }

  const course = await prisma.course.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
  });
  return toCourseView(course);
}

export async function setCourseActive(id: string, isActive: boolean) {
  const existing = await prisma.course.findUnique({ where: { id } });
  if (!existing) throw notFound("Course not found.");

  const course = await prisma.course.update({ where: { id }, data: { isActive } });
  return toCourseView(course);
}

/**
 * A course can only be deleted while nothing references it. Prisma's Restrict
 * on the relation would throw anyway; checking first gives a readable message.
 */
export async function deleteCourse(id: string) {
  const course = await prisma.course.findUnique({
    where: { id },
    include: { _count: { select: { assignments: true } } },
  });
  if (!course) throw notFound("Course not found.");

  if (course._count.assignments > 0) {
    throw conflict(
      `This course is used by ${course._count.assignments} assignment(s) and cannot be deleted. Deactivate it instead.`,
    );
  }

  await prisma.course.delete({ where: { id } });
  return { id, deleted: true };
}