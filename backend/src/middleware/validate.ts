import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

export interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Validates and *replaces* `req.body`, `req.query` and `req.params` with the
 * parsed output.
 *
 * Handlers therefore receive coerced, typed values (numbers as numbers,
 * trimmed strings, enums narrowed) rather than raw strings.
 * Unknown keys are stripped by default, so a client cannot smuggle in
 * `role: "SUPER_ADMIN"` on a public endpoint.
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.params) {
      req.params = schemas.params.parse(req.params) as typeof req.params;
    }
    if (schemas.query) {
      const parsed = schemas.query.parse(req.query) as unknown;
      // Express 4's `req.query` is a getter with no setter in some versions,
      // so define the property instead of assigning to it.
      Object.defineProperty(req, "query", {
        value: parsed,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    if (schemas.body) {
      req.body = schemas.body.parse(req.body);
    }
    next();
  };
}