import { z } from "zod";
import { levelSchema, monthSchema, progressRatingSchema, reportStatusSchema } from "../../../schemas/common.js";

export const listReportsQuerySchema = z.object({
  month: z.union([monthSchema, z.literal("all")]).default("all"),
  tutorId: z.string().trim().max(64).optional().transform((v) => (v ? v : undefined)),
  studentId: z.string().trim().max(64).optional().transform((v) => (v ? v : undefined)),
  courseId: z.string().trim().max(64).optional().transform((v) => (v ? v : undefined)),
  level: z.union([levelSchema, z.literal("all")]).default("all"),
  ageGroup: z.union([z.enum(["KIDS", "TEENS", "ADULTS"]), z.literal("all")]).default("all"),
  status: z.union([reportStatusSchema, z.literal("all")]).default("all"),
  progressRating: z
    .union([progressRatingSchema, z.literal("all")])
    .default("all"),
  search: z.string().trim().max(120).optional().transform((v) => (v ? v : undefined)),
  sort: z
    .enum(["studentName", "tutorName", "courseName", "submittedAt", "month", "progressRating", "status"])
    .default("submittedAt"),
  direction: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export const reviewBodySchema = z.object({
  note: z
    .string()
    .trim()
    .max(4000, "Keep the note under 4000 characters.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export const requestRevisionBodySchema = z.object({
  note: z
    .string()
    .trim()
    .min(5, "Tell the tutor what needs to change.")
    .max(4000, "Keep the note under 4000 characters."),
});

export const reportsExportQuerySchema = listReportsQuerySchema.omit({
  page: true,
  pageSize: true,
}).extend({
  pageSize: z.coerce.number().int().positive().max(5000).optional(),
});