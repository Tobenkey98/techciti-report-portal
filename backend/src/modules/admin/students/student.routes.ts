import { Router } from "express";
import { asyncHandler } from "../../../lib/async-handler.js";
import { validate } from "../../../middleware/validate.js";
import { idParamSchema } from "../../../schemas/common.js";
import { auditAdmin } from "../../../lib/activity-log.js";
import * as service from "./student.service.js";
import {
  createStudentSchema,
  listStudentsQuerySchema,
  updateStudentSchema,
} from "./student.schema.js";

/** `/api/admin/students` — manage students and their parent contacts. */
export const studentsRouter: Router = Router();

studentsRouter.get(
  "/",
  validate({ query: listStudentsQuerySchema }),
  asyncHandler(async (req, res) => {
    const data = await service.listStudents(req.query as never);
    res.json({ success: true, data });
  }),
);

studentsRouter.get(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.getStudent(req.params.id!);
    res.json({ success: true, data });
  }),
);

/** GET /api/admin/students/:id/profile — student + report timeline. */
studentsRouter.get(
  "/:id/profile",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.getStudentProfile(req.params.id!);
    res.json({ success: true, data });
  }),
);

studentsRouter.post(
  "/",
  validate({ body: createStudentSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.createStudent(req.body);
    await auditAdmin(req.admin!, "student.created", "student", data.id, { fullName: data.fullName });
    res.status(201).json({ success: true, data });
  }),
);

studentsRouter.patch(
  "/:id",
  validate({ params: idParamSchema, body: updateStudentSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.updateStudent(req.params.id!, req.body);
    await auditAdmin(req.admin!, "student.updated", "student", req.params.id!);
    res.json({ success: true, data });
  }),
);

studentsRouter.post(
  "/:id/deactivate",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.setStudentActive(req.params.id!, false);
    await auditAdmin(req.admin!, "student.deactivated", "student", req.params.id!);
    res.json({ success: true, data });
  }),
);

studentsRouter.post(
  "/:id/activate",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.setStudentActive(req.params.id!, true);
    await auditAdmin(req.admin!, "student.activated", "student", req.params.id!);
    res.json({ success: true, data });
  }),
);

studentsRouter.delete(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.deleteStudent(req.params.id!);
    await auditAdmin(req.admin!, "student.deleted", "student", req.params.id!);
    res.json({ success: true, data });
  }),
);