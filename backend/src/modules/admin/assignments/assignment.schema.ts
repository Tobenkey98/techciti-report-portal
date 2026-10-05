import { z } from "zod";
import { levelSchema } from "../../../schemas/common.js";

export const createAssignmentSchema = z.object({
  tutorId: z.string().min(1, "Choose a tutor."),
  studentId: z.string().min(1, "Choose a student."),
  courseId: z.string().min(1, "Choose a course."),
  level: levelSchema,
});

export const updateAssignmentSchema = z
  .object({
    tutorId: z.string().min(1).optional(),
    studentId: z.string().min(1).optional(),
    courseId: z.string().min(1).optional(),
    level: levelSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update." });

export const listAssignmentsQuerySchema = z.object({
  search: z.string().trim().max(120).optional().transform((v) => (v ? v : undefined)),
  tutorId: z.string().trim().max(64).optional().transform((v) => (v ? v : undefined)),
  studentId: z.string().trim().max(64).optional().transform((v) => (v ? v : undefined)),
  courseId: z.string().trim().max(64).optional().transform((v) => (v ? v : undefined)),
  level: z.union([levelSchema, z.literal("all")]).default("all"),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});