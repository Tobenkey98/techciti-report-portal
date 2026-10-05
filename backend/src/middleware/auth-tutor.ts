import type { NextFunction, Request, Response } from "express";
import type { Assignment } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { forbidden, notFound, unauthorized } from "../lib/errors.js";
import { safeEqual } from "../lib/crypto.js";
import { asyncHandler } from "../lib/async-handler.js";

export const TUTOR_TOKEN_HEADER = "x-tutor-token";

/**
 * Guards `/api/tutor/*`.
 *
 * The tutor has no account, no password and no session. The only credential is
 * the 48-character token in their private URL, which the frontend forwards in
 * the `X-Tutor-Token` header on every request.
 *
 * The token is looked up on every single request rather than being cached in a
 * JWT, which is what makes `regenerate-link` and deactivation take effect
 * immediately.
 */
export const requireTutor = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token =
    (req.get(TUTOR_TOKEN_HEADER) ?? "").trim() ||
    (typeof req.query.accessToken === "string" ? req.query.accessToken.trim() : "");

  if (!token) {
    throw unauthorized("This portal link is missing its access token.");
  }

  const tutor = await prisma.tutor.findUnique({ where: { accessToken: token } });

  // Same message whether the token does not exist or was revoked: do not leak
  // which tokens are real.
  if (!tutor || tutor.tokenRevokedAt) {
    throw unauthorized("This portal link is no longer valid. Please ask your TechCiti admin for a new link.");
  }
  if (!tutor.isActive) {
    throw forbidden("Your account has been deactivated. Please contact your TechCiti admin.");
  }

  req.tutor = tutor;
  next();
});

/**
 * Loads an assignment and proves it belongs to the authenticated tutor.
 *
 * Ownership is enforced in the query itself (`id` + `tutorId`), not by
 * fetching first and comparing in JavaScript, so a tutor can never read or write
 * another tutor's data even if they guess an id.
 *
 * @param paramName route parameter holding the assignment id, e.g. "assignmentId"
 */
export function ownedAssignment(paramName = "id") {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const assignmentId = String(req.params[paramName] ?? "");

    const assignment = await prisma.assignment.findFirst({
      where: { id: assignmentId, tutorId: req.tutor!.id, isActive: true },
      select: { id: true, tutorId: true, studentId: true, courseId: true, level: true },
    });

    if (!assignment) {
      // 404 rather than 403 so the response does not confirm that the
      // assignment exists but belongs to somebody else.
      throw notFound("That assignment is not on your list.");
    }

    res.locals.assignment = assignment;
    next();
  });
}

/** Typed accessor for the assignment resolved by `ownedAssignment`. */
export function getOwnedAssignment(res: Response): Assignment {
  const assignment = res.locals.assignment as Assignment | undefined;
  if (!assignment) {
    throw notFound("That assignment is not on your list.");
  }
  return assignment;
}

/** Constant-time token comparison helper for callers that need it. */
export const tokensMatch = safeEqual;