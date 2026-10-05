import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../config/constants.js";
import { badRequest } from "./errors.js";

export interface Pagination {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

function toPositiveInt(raw: unknown, fallback: number, max: number): number {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    throw badRequest(`Expected a positive integer, received "${String(raw)}".`);
  }
  return Math.min(value, max);
}

/**
 * Reads `?page` and `?pageSize` from a query object.
 *
 * Accepts either an Express request (its `.query` is used) or a plain parsed
 * query record. `pageSize` is capped at MAX_PAGE_SIZE so a client cannot ask
 * for everything at once.
 */
export function getPagination(source: unknown): Pagination {
  const container = source as { query?: Record<string, unknown> } | null;
  const query: Record<string, unknown> =
    container && typeof container === "object" && container.query && typeof container.query === "object"
      ? (container.query as Record<string, unknown>)
      : ((source ?? {}) as Record<string, unknown>);

  const page = toPositiveInt(query.page, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = toPositiveInt(query.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/** Wraps a Prisma `findMany` + `count` pair in a consistent envelope. */
export function paginated<T>(rows: T[], total: number, pagination: Pagination): Paginated<T> {
  const pageCount = pagination.pageSize > 0 ? Math.ceil(total / pagination.pageSize) : 0;
  return {
    rows,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    pageCount,
    hasNext: pagination.page < pageCount,
    hasPrevious: pagination.page > 1 && pageCount > 0,
  };
}

/** Normalises an untrusted sort direction. */
export function parseDirection(raw: unknown): "asc" | "desc" {
  return String(raw ?? "").toLowerCase() === "asc" ? "asc" : "desc";
}