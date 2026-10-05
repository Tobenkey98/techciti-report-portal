import { Router } from "express";
import { asyncHandler } from "../../../lib/async-handler.js";
import { validate } from "../../../middleware/validate.js";
import { idParamSchema } from "../../../schemas/common.js";
import { auditAdmin } from "../../../lib/activity-log.js";
import * as service from "./tutor.service.js";
import {
  createTutorSchema,
  listTutorsQuerySchema,
  shareLinkQuerySchema,
  updateTutorSchema,
} from "./tutor.schema.js";

/** `/api/admin/tutors` — manage tutors and their private portal links. */
export const tutorsRouter: Router = Router();

/** GET /api/admin/tutors?search=&status=&page=&pageSize= */
tutorsRouter.get(
  "/",
  validate({ query: listTutorsQuerySchema }),
  asyncHandler(async (req, res) => {
    const data = await service.listTutors(req.query as never);
    res.json({ success: true, data });
  }),
);

/** GET /api/admin/tutors/:id */
tutorsRouter.get(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.getTutor(req.params.id!);
    res.json({ success: true, data });
  }),
);

/** GET /api/admin/tutors/:id/link?month=YYYY-MM — portal URL + WhatsApp message. */
tutorsRouter.get(
  "/:id/link",
  validate({ params: idParamSchema, query: shareLinkQuerySchema }),
  asyncHandler(async (req, res) => {
    const data = await service.getLink(req.params.id!, req.query.month as string | undefined);
    res.json({ success: true, data });
  }),
);

/** POST /api/admin/tutors/:id/regenerate-link — revoke the old token, issue a new one. */
tutorsRouter.post(
  "/:id/regenerate-link",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.regenerateLink(req.params.id!);
    await auditAdmin(req.admin!, "tutor.link_regenerated", "tutor", req.params.id!, {
      fullName: data.fullName,
    });
    res.json({ success: true, data });
  }),
);

/** POST /api/admin/tutors */
tutorsRouter.post(
  "/",
  validate({ body: createTutorSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.createTutor(req.body);
    await auditAdmin(req.admin!, "tutor.created", "tutor", data.id, { fullName: data.fullName });
    res.status(201).json({ success: true, data });
  }),
);

/** PATCH /api/admin/tutors/:id */
tutorsRouter.patch(
  "/:id",
  validate({ params: idParamSchema, body: updateTutorSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.updateTutor(req.params.id!, req.body);
    await auditAdmin(req.admin!, "tutor.updated", "tutor", req.params.id!, req.body);
    res.json({ success: true, data });
  }),
);

/** POST /api/admin/tutors/:id/deactivate */
tutorsRouter.post(
  "/:id/deactivate",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.setTutorActive(req.params.id!, false);
    await auditAdmin(req.admin!, "tutor.deactivated", "tutor", req.params.id!);
    res.json({ success: true, data });
  }),
);

/** POST /api/admin/tutors/:id/activate */
tutorsRouter.post(
  "/:id/activate",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.setTutorActive(req.params.id!, true);
    await auditAdmin(req.admin!, "tutor.activated", "tutor", req.params.id!);
    res.json({ success: true, data });
  }),
);

/**
 * DELETE /api/admin/tutors/:id
 * Refuses when reports exist — deactivate instead of losing history.
 */
tutorsRouter.delete(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.deleteTutor(req.params.id!);
    await auditAdmin(req.admin!, "tutor.deleted", "tutor", req.params.id!);
    res.json({ success: true, data });
  }),
);