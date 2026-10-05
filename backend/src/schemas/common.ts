import { z } from "zod";
import {
  AGE_GROUPS,
  LEVELS,
  PROGRESS_RATINGS,
  REPORT_STATUSES,
} from "../config/constants.js";

/** `2026-10` */
export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use the YYYY-MM format, for example 2026-10.");

export const idParamSchema = z.object({
  id: z.string().min(1, "An id is required."),
});

export const idParamsSchema = z.object({
  assignmentId: z.string().min(1),
});

export const optionalBoolean = z
  .union([z.boolean(), z.enum(["true", "false"]), z.enum(["1", "0"])])
  .transform((value) => value === true || value === "true" || value === "1");

export const ageGroupSchema = z.enum(AGE_GROUPS);
export const levelSchema = z.enum(LEVELS);
export const progressRatingSchema = z.enum(PROGRESS_RATINGS);
export const reportStatusSchema = z.enum(REPORT_STATUSES);

/** Trimmed, non-empty string. */
export const requiredText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

/** Trimmed string that normalises empty input to `null`. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer.`)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .optional();

/** Email that is either absent or a valid address, stored lowercase. */
export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(191)
  .nullable()
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(191);

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(191, "That password is too long.");

export const searchSchema = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((value) => (value ? value : undefined));

/** `?page`/`?pageSize` handled separately, but kept here for consistency. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

/** `"all"` is the sentinel the admin filters use for "no filter". */
export const allOr = <T extends readonly [string, ...string[]]>(values: T) =>
  z.union([z.enum(values), z.literal("all")]);