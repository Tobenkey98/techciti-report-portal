import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import { asyncHandler } from "../../../lib/async-handler.js";
import { hashPassword } from "../../../lib/crypto.js";
import { badRequest, conflict, notFound } from "../../../lib/errors.js";
import { getPagination, paginated } from "../../../lib/pagination.js";
import { toAdminView } from "../../../lib/serialize.js";
import { requireSuperAdmin } from "../../../middleware/auth-admin.js";
import { validate } from "../../../middleware/validate.js";
import { emailSchema, idParamSchema, passwordSchema, requiredText } from "../../../schemas/common.js";
import { auditAdmin } from "../../../lib/activity-log.js";

const createAdminSchema = z.object({
  name: requiredText(120, "Name"),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(["SUPER_ADMIN", "ADMIN"]).default("ADMIN"),
});

const updateAdminSchema = z
  .object({
    name: requiredText(120, "Name").optional(),
    email: emailSchema.optional(),
    role: z.enum(["SUPER_ADMIN", "ADMIN"]).optional(),
    isActive: z.boolean().optional(),
    password: passwordSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update." });

const listAdminsQuerySchema = z.object({
  search: z.string().trim().max(120).optional().transform((v) => (v ? v : undefined)),
  role: z.union([z.enum(["SUPER_ADMIN", "ADMIN"]), z.literal("all")]).default("all"),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

/**
 * `/api/admin/admins`
 *
 * Guarded by `requireSuperAdmin`: a regular ADMIN must not be able to create
 * another admin or escalate a role.
 */
export const adminsRouter: Router = Router();

adminsRouter.use(requireSuperAdmin);

adminsRouter.get(
  "/",
  validate({ query: listAdminsQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof listAdminsQuerySchema>;
    const pagination = getPagination(query);

    const where = {
      ...(query.search
        ? { OR: [{ name: { contains: query.search } }, { email: { contains: query.search } }] }
        : {}),
      ...(query.role !== "all" ? { role: query.role } : {}),
      ...(query.status === "active" ? { isActive: true } : {}),
      ...(query.status === "inactive" ? { isActive: false } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.admin.findMany({ where, orderBy: { createdAt: "asc" }, skip: pagination.skip, take: pagination.take }),
      prisma.admin.count({ where }),
    ]);

    const result = paginated(rows, total, pagination);
    res.json({ success: true, data: { ...result, rows: result.rows.map(toAdminView) } });
  }),
);

adminsRouter.post(
  "/",
  validate({ body: createAdminSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createAdminSchema>;

    const existing = await prisma.admin.findUnique({ where: { email: body.email } });
    if (existing) throw conflict("An admin with that email already exists.", { email: "Already in use." });

    const admin = await prisma.admin.create({
      data: {
        name: body.name,
        email: body.email,
        role: body.role,
        passwordHash: await hashPassword(body.password),
      },
    });

    await auditAdmin(req.admin!, "admin.created", "admin", admin.id, { role: admin.role });
    res.status(201).json({ success: true, data: toAdminView(admin) });
  }),
);

adminsRouter.patch(
  "/:id",
  validate({ params: idParamSchema, body: updateAdminSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof updateAdminSchema>;
    const target = await prisma.admin.findUnique({ where: { id: req.params.id! } });
    if (!target) throw notFound("Admin not found.");

    // Safety rails: never let the last usable super admin lock everyone out.
    const demoting = (body.role && body.role !== "SUPER_ADMIN" && target.role === "SUPER_ADMIN") ||
      (body.isActive === false && target.role === "SUPER_ADMIN");

    if (demoting) {
      const activeSupers = await prisma.admin.count({
        where: { role: "SUPER_ADMIN", isActive: true, id: { not: target.id } },
      });
      if (activeSupers === 0) {
        throw badRequest("This is the last active super admin. Promote another admin first.");
      }
    }

    if (body.email && body.email !== target.email) {
      const clash = await prisma.admin.findUnique({ where: { email: body.email } });
      if (clash) throw conflict("An admin with that email already exists.", { email: "Already in use." });
    }

    const admin = await prisma.admin.update({
      where: { id: target.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.password !== undefined ? { passwordHash: await hashPassword(body.password) } : {}),
      },
    });

    await auditAdmin(req.admin!, "admin.updated", "admin", admin.id, {
      fields: Object.keys(body).filter((key) => key !== "password"),
      passwordReset: body.password !== undefined,
    });

    res.json({ success: true, data: toAdminView(admin) });
  }),
);

adminsRouter.post(
  "/:id/deactivate",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.admin!.id) {
      throw badRequest("You cannot deactivate your own account.");
    }

    const target = await prisma.admin.findUnique({ where: { id: req.params.id! } });
    if (!target) throw notFound("Admin not found.");

    if (target.role === "SUPER_ADMIN") {
      const otherSupers = await prisma.admin.count({
        where: { role: "SUPER_ADMIN", isActive: true, id: { not: target.id } },
      });
      if (otherSupers === 0) throw badRequest("This is the last active super admin.");
    }

    const admin = await prisma.admin.update({ where: { id: target.id }, data: { isActive: false } });
    await auditAdmin(req.admin!, "admin.deactivated", "admin", admin.id);
    res.json({ success: true, data: toAdminView(admin) });
  }),
);

adminsRouter.post(
  "/:id/activate",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const admin = await prisma.admin.update({ where: { id: req.params.id! }, data: { isActive: true } });
    await auditAdmin(req.admin!, "admin.activated", "admin", admin.id);
    res.json({ success: true, data: toAdminView(admin) });
  }),
);