import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Wraps an async handler so a rejected promise reaches Express' error
 * middleware instead of hanging the request.
 *
 * TypeScript cannot express this, so `route()` hands back a `RequestHandler`
 * with the promise type erased — callers still get full type safety on args.
 */
export function asyncHandler<T extends RequestHandler>(handler: T): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    void Promise.resolve(handler(req, res, next)).catch(next);
  };
}