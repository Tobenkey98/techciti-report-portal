import { z } from "zod";
import { ageGroupSchema, optionalEmail, optionalText, requiredText } from "../../../schemas/common.js";

export const createStudentSchema = z.object({
  fullName: requiredText(120, "Student name"),
  ageGroup: ageGroupSchema,
  parentName: optionalText(120),
  parentPhone: optionalText(32),
  parentEmail: optionalEmail,
});

export const updateStudentSchema = z
  .object({
    fullName: requiredText(120, "Student name").optional(),
    ageGroup: ageGroupSchema.optional(),
    parentName: optionalText(120),
    parentPhone: optionalText(32),
    parentEmail: optionalEmail,
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update." });

export const listStudentsQuerySchema = z.object({
  search: z.string().trim().max(120).optional().transform((v) => (v ? v : undefined)),
  ageGroup: z.union([ageGroupSchema, z.literal("all")]).default("all"),
  courseId: z.string().trim().max(64).optional().transform((v) => (v ? v : undefined)),
  tutorId: z.string().trim().max(64).optional().transform((v) => (v ? v : undefined)),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  sort: z.enum(["fullName", "createdAt"]).default("fullName"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});