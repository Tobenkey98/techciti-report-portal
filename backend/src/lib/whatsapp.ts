import { env } from "../config/env.js";
import { formatMonth } from "./month.js";

/**
 * Normalises a phone number for wa.me deep links.
 *
 * Nigerian numbers are the common case, so a bare local number is prefixed
 * with `+234`. Everything else is expected to already be international.
 * Strips spaces, dashes, brackets and a leading `00`/`+`.
 */
export function normalisePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  let digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (digits.startsWith("+")) digits = `+${digits.slice(1).replace(/\D/g, "")}`;
  else digits = digits.replace(/\D/g, "");

  if (!digits) return null;
  if (!digits.startsWith("+")) {
    // Assume a Nigerian local number.
    const national = digits.replace(/^0/, "");
    digits = `+234${national}`;
  }

  return digits;
}

/** `https://wa.me/<number>?text=<encoded>` */
export function whatsappLink(phone: string | null | undefined, message: string): string | null {
  const normalised = normalisePhone(phone);
  if (!normalised) return null;
  return `https://wa.me/${normalised.replace("+", "")}?text=${encodeURIComponent(message)}`;
}

/** A tutor's private portal URL: `<TUTOR_PORTAL_URL>/t/<token>`. */
export function tutorPortalUrl(token: string): string {
  return `${env.tutorPortalBase}/t/${token}`;
}

/**
 * Message an admin can send a tutor to share their private link.
 * The link itself is included so the tutor can simply forward it.
 */
export function tutorLinkInvite(tutorName: string, portalUrl: string, month: string): string {
  return [
    `Hi ${tutorName},`,
    "",
    "Here is your private TechCiti tutor portal link:",
    portalUrl,
    "",
    `Please open it to submit your ${formatMonth(month)} reports.`,
    "The link is personal — please don't forward it to anyone else.",
  ].join("\n");
}

/** Reminder sent to a tutor who still has outstanding reports. */
export function tutorReminder(
  tutorName: string,
  portalUrl: string,
  month: string,
  outstanding: number,
): string {
  return [
    `Hi ${tutorName},`,
    "",
    `You still have ${outstanding} ${outstanding === 1 ? "report" : "reports"} to submit for ${formatMonth(month)}.`,
    "Open your portal to finish them:",
    portalUrl,
    "",
    "Thanks!",
    "TechCiti",
  ].join("\n");
}

/** Notification to a parent that a monthly report is ready. */
export function parentReportReady(
  studentName: string,
  courseName: string,
  month: string,
  status: string,
): string {
  return [
    `Hello,`,
    "",
    `${studentName}'s ${formatMonth(month)} ${courseName} report is ${status.toLowerCase()}.`,
    "Log in to the TechCiti portal to read the full report.",
    "",
    "Thank you,",
    "TechCiti",
  ].join("\n");
}