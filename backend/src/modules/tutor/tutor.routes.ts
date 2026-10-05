import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { requireTutor, ownedAssignment, getOwnedAssignment } from "../../middleware/auth-tutor.js";
import { validate } from "../../middleware/validate.js";
import { idParamsSchema, monthSchema } from "../../schemas/common.js";
import { auditTutor } from "../../lib/activity-log.js";
import { formatMonth } from "../../lib/month.js";
import * as service from "./tutor.service.js";
import {
  draftBodySchema,
  submitBodySchema,
  tutorAssignmentsQuerySchema,
  tutorReportQuerySchema,
} from "./tutor.schema.js";

const monthQuery = { month: monthSchema.optional() };

/**
 * `/api/tutor/*` â€” the tutor portal.
 *
 * There is no login, no password and no session. The `X-Tutor-Token` header
 * carries the token from the private `/t/<token>` URL, and every query is
 * scoped to the tutor resolved from it.
 *
 * This router intentionally exposes nothing that is not about the signed-in
 * tutor's own students. There are no admin routes, links or counts here.
 */
export const tutorRouter: Router = Router();

tutorRouter.use(requireTutor);

/** GET /api/tutor/me â€” who am I? */
tutorRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const data = await service.getMe(req.tutor!.id);
    res.json({ success: true, data });
  }),
);

/** GET /api/tutor/assignments?month=YYYY-MM â€” the student list + progress counts. */
tutorRouter.get(
  "/assignments",
  validate({ query: tutorAssignmentsQuerySchema }),
  asyncHandler(async (req, res) => {
    const data = await service.listAssignments(req.tutor!.id, req.query.month as string | undefined);
    res.json({ success: true, data });
  }),
);

/** GET /api/tutor/reports/:assignmentId/previous?month=YYYY-MM â€” "Copy from last month". */
tutorRouter.get(
  "/reports/:assignmentId/previous",
  validate({ params: idParamsSchema, query: tutorReportQuerySchema }),
  ownedAssignment("assignmentId"),
  asyncHandler(async (req, res) => {
    const assignment = getOwnedAssignment(res);
    const data = await service.getPreviousReport(req.tutor!.id, assignment.id, req.query.month as string | undefined);
    res.json({ success: true, data });
  }),
);

/** GET /api/tutor/reports/:assignmentId?month=YYYY-MM â€” existing draft or null. */
tutorRouter.get(
  "/reports/:assignmentId",
  validate({ params: idParamsSchema, query: tutorReportQuerySchema }),
  ownedAssignment("assignmentId"),
  asyncHandler(async (req, res) => {
    const assignment = getOwnedAssignment(res);
    const data = await service.getReport(req.tutor!.id, assignment.id, req.query.month as string | undefined);
    res.json({ success: true, data });
  }),
);

/** PUT /api/tutor/reports/:assignmentId â€” autosave draft. */
tutorRouter.put(
  "/reports/:assignmentId",
  validate({ params: idParamsSchema, body: draftBodySchema }),
  ownedAssignment("assignmentId"),
  asyncHandler(async (req, res) => {
    const assignment = getOwnedAssignment(res);
    const data = await service.saveDraft(req.tutor!.id, assignment.id, req.body);

    if (req.body.month) {
      await auditTutor(
        req.tutor!,
        "report.autosaved",
        "report",
        data.id,
        { assignmentId: assignment.id, month: req.body.month },
      );
    }

    res.json({ success: true, data, meta: { savedAt: new Date().toISOString() } });
  }),
);

/** POST /api/tutor/reports/:assignmentId/submit â€” final submission. */
tutorRouter.post(
  "/reports/:assignmentId/submit",
  validate({ params: idParamsSchema, body: submitBodySchema }),
  ownedAssignment("assignmentId"),
  asyncHandler(async (req, res) => {
    const assignment = getOwnedAssignment(res);
    const data = await service.submitReport(req.tutor!.id, assignment.id, req.body);

    await auditTutor(req.tutor!, "report.submitted", "report", data.id, {
      assignmentId: assignment.id,
      month: data.month,
      monthLabel: formatMonth(data.month),
    });

    res.status(201).json({ success: true, data });
  }),
);