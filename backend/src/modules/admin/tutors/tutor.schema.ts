import { z } from "zod";
import {
  optionalEmail,
  requiredText,
} from "../../../schemas/common.js";

export const createTutorSchema = z.object({
  fullName: requiredText(120, "Tutor name"),
  email: optionalEmail,
  phone: z
    .string()
    .trim()
    .min(7, "Enter a phone number we can reach them on.")
    .max(32, "That phone number is too long."),
});

export const updateTutorSchema = z
  .object({
    fullName: requiredText(120, "Tutor name").optional(),
    email: optionalEmail,
    phone: z.string().trim().min(7, "Enter a phone number we can reach them on.").max(32).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update." });

export const listTutorsQuerySchema = z.object({
  search: z.string().trim().max(120).optional().transform((v) => (v ? v : undefined)),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  sort: z.enum(["fullName", "createdAt", "reports"]).default("fullName"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});

export const shareLinkQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use the YYYY-MM format.")
    .optional(),
});