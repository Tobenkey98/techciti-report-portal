import { Router } from "express";
import { asyncHandler } from "../../../lib/async-handler.js";
import { validate } from "../../../middleware/validate.js";
import { idParamSchema } from "../../../schemas/common.js";
import { auditAdmin } from "../../../lib/activity-log.js";
import * as service from "./assignment.service.js";
import {
  createAssignmentSchema,
  listAssignmentsQuerySchema,
  updateAssignmentSchema,
} from "./assignment.schema.js";

/** `/api/admin/assignments` — which tutor teaches which course to which student. */
export const assignmentsRouter: Router = Router();

assignmentsRouter.get(
  "/",
  validate({ query: listAssignmentsQuerySchema }),
  asyncHandler(async (req, res) => {
    const data = await service.listAssignments(req.query as never);
    res.json({ success: true, data });
  }),
);

assignmentsRouter.post(
  "/",
  validate({ body: createAssignmentSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.createAssignment(req.body);
    await auditAdmin(req.admin!, "assignment.created", "assignment", data.id, {
      tutorId: data.tutorId,
      studentId: data.studentId,
      courseId: data.courseId,
    });
    res.status(201).json({ success: true, data });
  }),
);

assignmentsRouter.patch(
  "/:id",
  validate({ params: idParamSchema, body: updateAssignmentSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.updateAssignment(req.params.id!, req.body);
    await auditAdmin(req.admin!, "assignment.updated", "assignment", req.params.id!);
    res.json({ success: true, data });
  }),
);

assignmentsRouter.post(
  "/:id/deactivate",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.setAssignmentActive(req.params.id!, false);
    await auditAdmin(req.admin!, "assignment.deactivated", "assignment", req.params.id!);
    res.json({ success: true, data });
  }),
);

assignmentsRouter.post(
  "/:id/activate",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.setAssignmentActive(req.params.id!, true);
    await auditAdmin(req.admin!, "assignment.activated", "assignment", req.params.id!);
    res.json({ success: true, data });
  }),
);

/** DELETE is a soft delete — reports must keep their historical reference. */
assignmentsRouter.delete(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.deleteAssignment(req.params.id!);
    await auditAdmin(req.admin!, "assignment.deactivated", "assignment", req.params.id!);
    res.json({ success: true, data });
  }),
);