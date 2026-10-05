import { z } from "zod";
import { requiredText } from "../../../schemas/common.js";

export const createCourseSchema = z.object({
  name: requiredText(120, "Course name"),
  category: requiredText(60, "Category"),
  isActive: z.boolean().optional(),
});

export const updateCourseSchema = z
  .object({
    name: requiredText(120, "Course name").optional(),
    category: requiredText(60, "Category").optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update." });

export const listCoursesQuerySchema = z.object({
  search: z.string().trim().max(120).optional().transform((v) => (v ? v : undefined)),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});