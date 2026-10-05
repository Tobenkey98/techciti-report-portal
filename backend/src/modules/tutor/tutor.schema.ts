import { z } from "zod";
import {
  monthSchema,
  optionalText,
  progressRatingSchema,
  requiredText,
} from "../../schemas/common.js";

/**
 * The editable shape of a monthly report. Autosave (`PUT`) accepts a partial
 * payload so a tutor can save as they type; `POST /submit` runs the strict
 * rules in `submitSchema` below.
 */
export const draftBodySchema = z.object({
  topicsCovered: z.string().trim().max(8000, "Keep topics under 8000 characters.").default(""),
  continuityNeeded: z.boolean().default(false),
  continuityNote: z
    .string()
    .trim()
    .max(4000, "Keep the note under 4000 characters.")
    .nullable()
    .optional()
    .transform((value) => (value ? value : null)),
  generalFeedback: z.string().trim().max(6000, "Keep feedback under 6000 characters.").default(""),
  tutorComment: z.string().trim().max(6000, "Keep the comment under 6000 characters.").default(""),
  progressRating: progressRatingSchema.nullable().optional().default(null),
  sessionsHeld: z.coerce.number().int().min(0).max(999).nullable().optional().default(null),
  sessionsAttended: z.coerce.number().int().min(0).max(999).nullable().optional().default(null),
  month: monthSchema.optional(),
});

export type DraftBody = z.infer<typeof draftBodySchema>;

/**
 * Submission rules:
 *   • topicsCovered, generalFeedback, tutorComment and progressRating required
 *   • continuityNote required when continuityNeeded is true
 *   • a minimum length on the free-text fields, so a report cannot be submitted empty
 */
export const submitBodySchema = draftBodySchema.superRefine((value, ctx) => {
  if (value.topicsCovered.trim().length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["topicsCovered"],
      message: "Tell us what you covered this month.",
    });
  } else if (value.topicsCovered.trim().length < 10) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["topicsCovered"],
      message: "Add a little more detail — at least 10 characters.",
    });
  }

  if (value.generalFeedback.trim().length < 10) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["generalFeedback"],
      message: "General feedback is required (at least 10 characters).",
    });
  }

  if (value.tutorComment.trim().length < 5) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["tutorComment"],
      message: "Add a short tutor comment (at least 5 characters).",
    });
  }

  if (!value.progressRating) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["progressRating"],
      message: "Choose a progress rating.",
    });
  }

  if (value.continuityNeeded && !value.continuityNote?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["continuityNote"],
      message: "Explain what needs to continue.",
    });
  }

  if (value.sessionsHeld !== null && value.sessionsAttended !== null && value.sessionsHeld !== undefined) {
    if ((value.sessionsAttended ?? 0) > value.sessionsHeld) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sessionsAttended"],
        message: "Sessions attended cannot exceed sessions held.",
      });
    }
  }
});

export type SubmitBody = z.infer<typeof submitBodySchema>;

export const tutorAssignmentsQuerySchema = z.object({
  month: monthSchema.optional(),
});

export const tutorReportQuerySchema = z.object({
  month: monthSchema.optional(),
});

export { requiredText, optionalText };