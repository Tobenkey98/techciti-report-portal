import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { MonthKey } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ---------------------------------- Dates ---------------------------------- */

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const SHORT_MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Current month as `YYYY-MM` in local time. */
export function getCurrentMonth(date: Date = new Date()): MonthKey {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/** `2026-10` -> `October 2026` */
export function formatMonth(month: MonthKey): string {
  const [year, monthIndex] = parseMonth(month);
  return `${MONTH_NAMES[monthIndex - 1]} ${year}`;
}

/** `2026-10` -> `Oct 2026` */
export function formatMonthShort(month: MonthKey): string {
  const [year, monthIndex] = parseMonth(month);
  return `${SHORT_MONTH_NAMES[monthIndex - 1]} ${year}`;
}

/** `2026-10` -> `October` */
export function monthLabel(month: MonthKey): string {
  const [, monthIndex] = parseMonth(month);
  return MONTH_NAMES[monthIndex - 1];
}

function parseMonth(month: MonthKey): [number, number] {
  const [yearPart, monthPart] = month.split("-");
  const year = Number(yearPart);
  const monthIndex = Number(monthPart);
  if (!year || !monthIndex) return [new Date().getFullYear(), 1];
  return [year, Math.min(12, Math.max(1, monthIndex))];
}

/** Shifts a `YYYY-MM` key by a number of months (negative for the past). */
export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [year, monthIndex] = parseMonth(month);
  const zeroBased = year * 12 + (monthIndex - 1) + delta;
  const nextYear = Math.floor(zeroBased / 12);
  const nextMonth = (zeroBased % 12 + 12) % 12 + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

export function monthsAgo(count: number): MonthKey {
  return shiftMonth(getCurrentMonth(), -count);
}

/** Selectable months: most recent first, `count` entries ending at `endMonth`. */
export function monthOptions(count = 12, endMonth: MonthKey = getCurrentMonth()): MonthKey[] {
  return Array.from({ length: count }, (_, index) => shiftMonth(endMonth, -index));
}

/** The reporting month is not allowed to run into the future. */
export function isFutureMonth(month: MonthKey): boolean {
  return month > getCurrentMonth();
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Human relative time, e.g. "3 days ago". */
export function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} mo ago`;
  return `${Math.round(months / 12)} yr ago`;
}

/* --------------------------------- Strings --------------------------------- */

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/** "needs_revision" -> "Needs revision" */
export function humaniseStatus(value: string): string {
  return titleCase(value);
}

/** Strips everything except digits from a WhatsApp number and adds the country code. */
export function normalisePhone(value: string, countryCode = "234"): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const local = digits.startsWith("0") ? digits.slice(1) : digits;
  const withoutCode = local.startsWith(countryCode) ? local.slice(countryCode.length) : local;
  return `${countryCode}${withoutCode}`;
}

export function prettyPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 11) return value;
  return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
}

/** Builds a wa.me deep link with a pre-filled message. */
export function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${normalisePhone(phone)}?text=${encodeURIComponent(message)}`;
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function initialsAvatarColor(seed: string): string {
  const palette = [
    "bg-primary-soft text-primary",
    "bg-success-soft text-success",
    "bg-warning-soft text-warning",
    "bg-danger-soft text-danger",
  ];
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 997;
  }
  return palette[hash % palette.length];
}