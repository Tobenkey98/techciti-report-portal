import { Router } from "express";
import { asyncHandler } from "../../../lib/async-handler.js";
import { validate } from "../../../middleware/validate.js";
import { idParamSchema } from "../../../schemas/common.js";
import { auditAdmin } from "../../../lib/activity-log.js";
import * as service from "./course.service.js";
import { createCourseSchema, listCoursesQuerySchema, updateCourseSchema } from "./course.schema.js";

/** `/api/admin/courses` — the course catalogue. */
export const coursesRouter: Router = Router();

coursesRouter.get(
  "/",
  validate({ query: listCoursesQuerySchema }),
  asyncHandler(async (req, res) => {
    const data = await service.listCourses(req.query as never);
    res.json({ success: true, data });
  }),
);

coursesRouter.post(
  "/",
  validate({ body: createCourseSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.createCourse(req.body);
    await auditAdmin(req.admin!, "course.created", "course", data.id, { name: data.name });
    res.status(201).json({ success: true, data });
  }),
);

coursesRouter.patch(
  "/:id",
  validate({ params: idParamSchema, body: updateCourseSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.updateCourse(req.params.id!, req.body);
    await auditAdmin(req.admin!, "course.updated", "course", req.params.id!);
    res.json({ success: true, data });
  }),
);

coursesRouter.post(
  "/:id/deactivate",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.setCourseActive(req.params.id!, false);
    await auditAdmin(req.admin!, "course.deactivated", "course", req.params.id!);
    res.json({ success: true, data });
  }),
);

coursesRouter.post(
  "/:id/activate",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.setCourseActive(req.params.id!, true);
    await auditAdmin(req.admin!, "course.activated", "course", req.params.id!);
    res.json({ success: true, data });
  }),
);

coursesRouter.delete(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.deleteCourse(req.params.id!);
    await auditAdmin(req.admin!, "course.deleted", "course", req.params.id!);
    res.json({ success: true, data });
  }),
);