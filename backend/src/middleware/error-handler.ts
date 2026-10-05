import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { MulterError } from "multer";
import { ApiError, isApiError } from "../lib/errors.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

/** Anything that reaches here without a response is a bug → 500. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: `No route matches ${req.method} ${req.originalUrl}` },
  });
}

interface NormalisedError {
  status: number;
  code: string;
  message: string;
  details?: Record<string, string>;
}

function normalise(error: unknown): NormalisedError {
  if (isApiError(error)) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  if (error instanceof ZodError) {
    const details: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.length > 0 ? issue.path.join(".") : "_";
      if (!(key in details)) details[key] = issue.message;
    }
    return {
      status: 422,
      code: "VALIDATION_ERROR",
      message: "Some fields need attention.",
      details,
    };
  }

  if (error instanceof MulterError) {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? `File is too large. The maximum is ${Math.round(env.uploadMaxBytes / 1024 / 1024)} MB.`
        : `Upload rejected: ${error.message}`;
    return { status: 400, code: "BAD_REQUEST", message };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = (error.meta?.target as string[] | undefined)?.join(", ") ?? "field";
      return {
        status: 409,
        code: "CONFLICT",
        message: `That ${target} is already in use.`,
      };
    }
    if (error.code === "P2025") {
      return { status: 404, code: "NOT_FOUND", message: "Resource not found." };
    }
    if (error.code === "P2003") {
      return {
        status: 409,
        code: "CONFLICT",
        message: "That record is still referenced by other data and cannot be changed.",
      };
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      status: 500,
      code: "INTERNAL_ERROR",
      message: "The database schema is out of date. Run `npm run db:push` or `npm run db:migrate`.",
    };
  }

  return {
    status: 500,
    code: "INTERNAL_ERROR",
    message: "Something went wrong on our side. Please try again.",
  };
}

/**
 * Terminal error handler. Translates every known failure into the standard
 * error envelope and never leaks stack traces or SQL to the client in
 * production.
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  const normalised = normalise(error);

  const logPayload = {
    method: req.method,
    url: req.originalUrl,
    status: normalised.status,
    code: normalised.code,
    message: normalised.message,
  };

  if (normalised.status >= 500) {
    logger.error({ ...logPayload, err: error instanceof Error ? error : new Error(String(error)) }, "request failed");
  } else {
    logger.warn(logPayload, "request rejected");
  }

  res.status(normalised.status).json({
    success: false,
    error: {
      code: normalised.code,
      message: normalised.message,
      ...(normalised.details ? { details: normalised.details } : {}),
      ...(env.isProduction ? {} : { debug: error instanceof Error ? error.message : String(error) }),
    },
  });
}