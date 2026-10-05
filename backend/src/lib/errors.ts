/**
 * Typed application errors.
 *
 * Anything thrown as `ApiError` is considered "expected" and is translated
 * into a clean JSON response by the global error handler. Everything else is
 * treated as a bug: logged with a stack trace and reported as a 500.
 */
export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "DUPLICATE_REPORT"
  | "RATE_LIMITED"
  | "LOCKED"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  DUPLICATE_REPORT: 409,
  RATE_LIMITED: 429,
  LOCKED: 423,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  /** Per-field messages so forms can highlight individual inputs. */
  readonly details?: Record<string, string>;
  readonly meta?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { details?: Record<string, string>; meta?: Record<string, unknown> },
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = options?.details;
    this.meta = options?.meta;
    Error.captureStackTrace?.(this, ApiError);
  }
}

export const badRequest = (message: string, details?: Record<string, string>) =>
  new ApiError("BAD_REQUEST", message, { details });

export const unauthorized = (message = "Authentication required.") =>
  new ApiError("UNAUTHORIZED", message);

export const forbidden = (message = "You do not have access to this resource.") =>
  new ApiError("FORBIDDEN", message);

export const notFound = (message = "Resource not found.") => new ApiError("NOT_FOUND", message);

export const conflict = (message: string, details?: Record<string, string>) =>
  new ApiError("CONFLICT", message, { details });

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}