import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { verifyAdminToken } from "../lib/crypto.js";
import { prisma } from "../lib/prisma.js";
import { forbidden, unauthorized } from "../lib/errors.js";
import { asyncHandler } from "../lib/async-handler.js";

function extractToken(req: Request): string | null {
  const cookieToken = req.cookies?.[env.COOKIE_NAME] as string | undefined;
  if (cookieToken) return cookieToken;

  // `Authorization: Bearer …` is accepted as a fallback so non-browser clients
  // (mobile, curl, Postman) can authenticate without juggling cookies.
  const header = req.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  return null;
}

/**
 * Guards `/api/admin/*`.
 *
 * The JWT is read from an httpOnly cookie (or a Bearer header), verified, and
 * the admin is re-read from the database on every request so that deactivating
 * an account takes effect immediately instead of waiting for the token to
 * expire.
 */
export const requireAdmin = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) {
    throw unauthorized("Sign in to continue.");
  }

  let payload: { adminId: string };
  try {
    payload = verifyAdminToken(token);
  } catch {
    throw unauthorized("Your session has expired. Please sign in again.");
  }

  const admin = await prisma.admin.findUnique({ where: { id: payload.adminId } });
  if (!admin) throw unauthorized("Your account no longer exists.");
  if (!admin.isActive) throw forbidden("Your account has been deactivated.");

  req.admin = {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    isActive: admin.isActive,
  };
  next();
});

/** Restricts a route to SUPER_ADMIN accounts. Use after `requireAdmin`. */
export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.admin) throw unauthorized("Sign in to continue.");
  if (req.admin.role !== "SUPER_ADMIN") {
    throw forbidden("Only a super admin can perform this action.");
  }
  next();
}