import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { env } from "../config/env.js";
import { MONTH_PATTERN } from "../config/constants.js";
import { badRequest } from "./errors.js";

dayjs.extend(utc);
dayjs.extend(timezone);

/** The timezone all human-facing dates are interpreted and rendered in. */
export const TZ = env.DEFAULT_TIMEZONE;

/** `dayjs` in the configured business timezone. */
export const now = (): dayjs.Dayjs => dayjs().tz(TZ);
export const today = (): string => now().format("YYYY-MM-DD");

/** Current month as `YYYY-MM` in the business timezone. */
export const currentMonth = (): string => now().format("YYYY-MM");

export function formatMonth(month: string): string {
  return dayjs(`${month}-01`).format("MMMM YYYY");
}

/** `2026-10` → `2026`, `10` */
export const monthYear = (month: string): string => month.slice(0, 4);
export const monthNumber = (month: string): string => month.slice(5, 7);

export function addMonths(month: string, delta: number): string {
  return dayjs(`${month}-01`).add(delta, "month").format("YYYY-MM");
}

/** Whole months from `month` back to `fromMonth` (positive when earlier). */
export function monthsBetween(fromMonth: string, toMonth: string): number {
  const [fy, fm] = fromMonth.split("-").map(Number) as [number, number];
  const [ty, tm] = toMonth.split("-").map(Number) as [number, number];
  return (ty * 12 + tm) - (fy * 12 + fm);
}

/** A list of `count` months ending at (and including) `endMonth`, oldest first. */
export function recentMonths(count: number, endMonth: string = currentMonth()): string[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) =>
    addMonths(endMonth, index - (count - 1)),
  );
}

export function isValidMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH_PATTERN.test(value);
}

/**
 * Resolves the month a request is about, defaulting to the current one.
 *
 * Rejects anything malformed, and anything beyond the current month plus
 * `MAX_MONTHS_AHEAD` (0 by default) — a tutor cannot open or submit a report
 * for a month that has not happened yet.
 *
 * `allowFuture` lets a caller *look ahead* within that same cap, which is what
 * the dashboard's month picker needs to render an empty future period. It never
 * extends the cap.
 */
export function resolveMonth(raw: unknown, options: { allowFuture?: boolean } = {}): string {
  void options.allowFuture;
  const month = raw === undefined || raw === null || raw === "" ? currentMonth() : String(raw);

  if (!isValidMonth(month)) {
    throw badRequest("month must look like YYYY-MM, for example 2026-10.", { month: "Invalid month." });
  }

  // monthsBetween(current, month) is positive when `month` lies in the future.
  const ahead = monthsBetween(currentMonth(), month);
  if (ahead > env.MAX_MONTHS_AHEAD) {
    const latest = addMonths(currentMonth(), env.MAX_MONTHS_AHEAD);
    throw badRequest(
      `Reports can only be created up to ${formatMonth(latest)}. ${formatMonth(month)} has not started yet.`,
      { month: "Month cannot be in the future." },
    );
  }

  return month;
}

/** ISO timestamp for `Date` → database-friendly `YYYY-MM-DD HH:mm:ss` in UTC. */
export function toDbDate(date: Date | null | undefined): string | null {
  return date ? dayjs(date).utc().format("YYYY-MM-DD HH:mm:ss") : null;
}

export function toDbDateTime(date: Date | null | undefined): Date | null {
  return date ? dayjs(date).toDate() : null;
}

/** `2026-10-04T14:32:00.000Z` → `4 Oct 2026, 2:32 pm` (Lagos by default). */
export function formatDateTime(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return dayjs(date).tz(TZ).format("D MMM YYYY, h:mm a");
}

/** `2026-10-04T14:32:00.000Z` → `4 Oct 2026` */
export function formatDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return dayjs(date).tz(TZ).format("D MMM YYYY");
}

export { dayjs };