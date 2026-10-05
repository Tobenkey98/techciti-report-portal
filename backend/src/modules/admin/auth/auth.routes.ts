import { Router } from "express";
import { z } from "zod";
import { env } from "../../../config/env.js";
import { prisma } from "../../../lib/prisma.js";
import { asyncHandler } from "../../../lib/async-handler.js";
import { hashPassword, signAdminToken, verifyAdminToken, verifyPassword } from "../../../lib/crypto.js";
import { badRequest, unauthorized } from "../../../lib/errors.js";
import { toAdminView } from "../../../lib/serialize.js";
import { loginLimiter } from "../../../middleware/rate-limit.js";
import { requireAdmin } from "../../../middleware/auth-admin.js";
import { validate } from "../../../middleware/validate.js";
import { emailSchema, passwordSchema } from "../../../schemas/common.js";
import { auditAdmin, recordActivity } from "../../../lib/activity-log.js";
import {
  LOGIN_MAX_FAILURES,
  lockState,
  recordFailure,
  recordSuccess,
} from "../../../lib/login-throttle.js";
import { logger } from "../../../lib/logger.js";

const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(191),
});

const passwordBodySchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: passwordSchema,
  confirmPassword: z.string().optional(),
});

/**
 * `/api/admin/auth/*`
 *
 * The session is a JWT delivered in an httpOnly, SameSite=Strict cookie so that
 * no JavaScript in either portal can read it. Because the tutor and admin apps
 * are separate origins, `SameSite=Strict` is exactly right: the browser will
 * never attach the admin cookie to a tutor-portal request, and cross-site
 * request forgery is structurally prevented.
 */
export const authRouter: Router = Router();

function setSessionCookie(res: import("express").Response, token: string): void {
  res.cookie(env.COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 60 * 60 * 1000,
  });
}

/** POST /api/admin/auth/login */
authRouter.post(
  "/login",
  loginLimiter,
  validate({ body: loginBodySchema }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginBodySchema>;
    const key = `${req.ip ?? "unknown"}:${email}`;

    const state = lockState(key);
    if (state.locked) {
      res.setHeader("Retry-After", String(state.retryAfterSeconds));
      res.status(423).json({
        success: false,
        error: {
          code: "LOCKED",
          message: `Too many failed attempts. Try again in ${Math.ceil(state.retryAfterSeconds / 60)} minutes.`,
          details: { retryAfterSeconds: String(state.retryAfterSeconds) },
        },
      });
      return;
    }

    const admin = await prisma.admin.findUnique({ where: { email } });

    // Compare against a dummy hash when the account does not exist so that the
    // response time does not reveal whether an email is registered.
    const hash = admin?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin";
    const passwordMatches = await verifyPassword(password, hash);

    if (!admin || !passwordMatches) {
      const after = recordFailure(key);
      logger.warn({ email, ip: req.ip, locked: after.locked }, "failed sign-in");
      await recordActivity({
        actorType: "SYSTEM",
        actorId: "auth",
        action: "auth.login_failed",
        entityType: "admin",
        entityId: email,
        meta: { ip: req.ip ?? null, remaining: Math.max(0, after.remaining) },
      });

      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Email or password is incorrect.",
          ...(after.locked ? { details: { locked: "Too many attempts. Try again in 15 minutes." } } : {}),
        },
      });
      return;
    }

    if (!admin.isActive) {
      throw unauthorized("This account has been deactivated.");
    }

    recordSuccess(key);

    const token = signAdminToken({ adminId: admin.id, email: admin.email, role: admin.role });
    setSessionCookie(res, token);

    const updated = await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    await auditAdmin(admin, "auth.login", "admin", admin.id, { ip: req.ip ?? null });

    res.json({ success: true, data: { admin: toAdminView(updated) } });
  }),
);

/** POST /api/admin/auth/logout */
authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    // Clear the cookie regardless of whether the token is still valid, so a
    // stale session can never trap the user in a half-signed-in state.
    res.clearCookie(env.COOKIE_NAME, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: "strict",
      path: "/",
    });

    const token = req.cookies?.[env.COOKIE_NAME] as string | undefined;
    if (token) {
      try {
        const payload = verifyAdminToken(token);
        await recordActivity({
          actorType: "ADMIN",
          actorId: payload.adminId,
          action: "auth.logout",
          entityType: "admin",
          entityId: payload.adminId,
        });
      } catch {
        /* the token was already invalid — nothing to attribute */
      }
    }

    res.json({ success: true, data: { message: "Signed out." } });
  }),
);

/** GET /api/admin/auth/me — who am I? Used by the admin app on every load. */
authRouter.get(
  "/me",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const admin = await prisma.admin.findUnique({ where: { id: req.admin!.id } });
    if (!admin) throw unauthorized("Your account no longer exists.");
    res.json({ success: true, data: { admin: toAdminView(admin) } });
  }),
);

/** PATCH /api/admin/auth/password — change your own password. */
authRouter.patch(
  "/password",
  requireAdmin,
  validate({ body: passwordBodySchema }),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body as z.infer<typeof passwordBodySchema>;

    if (confirmPassword !== undefined && confirmPassword !== newPassword) {
      throw badRequest("The two new passwords do not match.", {
        confirmPassword: "Passwords do not match.",
      });
    }

    const admin = await prisma.admin.findUnique({ where: { id: req.admin!.id } });
    if (!admin) throw unauthorized("Your account no longer exists.");

    if (!(await verifyPassword(currentPassword, admin.passwordHash))) {
      throw badRequest("Your current password is incorrect.", {
        currentPassword: "Incorrect password.",
      });
    }

    if (await verifyPassword(newPassword, admin.passwordHash)) {
      throw badRequest("Choose a password you have not used before.", {
        newPassword: "New password must be different from the current one.",
      });
    }

    await prisma.admin.update({
      where: { id: admin.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    await auditAdmin(admin, "auth.password_changed", "admin", admin.id);

    res.json({ success: true, data: { message: "Password updated." } });
  }),
);

export { LOGIN_MAX_FAILURES, loginBodySchema };