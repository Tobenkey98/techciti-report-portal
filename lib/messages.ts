import { SITE_URL } from "@/lib/constants";

const brand = "TechCiti";

/** Pre-filled WhatsApp copy for each reminder flow. */
export const messages = {
  /** Admin nudging a tutor who has not finished the month. */
  tutorReminder(params: { tutorFirstName: string; month: string; outstanding: number; link: string }) {
    return [
      `Hi ${params.tutorFirstName} 👋`,
      "",
      `A quick reminder from ${brand}: you still have ${params.outstanding} student report${params.outstanding === 1 ? "" : "s"} to submit for ${params.month}.`,
      "",
      "It takes about two minutes per student — pick up where you left off here:",
      params.link,
      "",
      "Need help? Just reply to this message.",
      "",
      `— ${brand} Tutors`,
    ].join("\n");
  },

/** Sending a tutor their private portal link for the first time. */
  tutorLinkInvite(params: { tutorName: string; link: string }) {
    return [
      `Hi ${params.tutorName} 👋`,
      "",
      `Welcome to the ${brand} Tutor Portal. This is your private link — use it every month to submit student reports.`,
      "",
      params.link,
      "",
      "Please keep this link to yourself. Bookmark it so it is always one tap away.",
      `Questions? Call us on ${SITE_URL.replace("https://", "")}.`,
      "",
      `— ${brand} Tutors`,
    ].join("\n");
  },

  /** Telling a parent their child's report is ready. */
  parentReportReady(params: { parentName: string; studentName: string; month: string }) {
    return [
      `Dear ${params.parentName},`,
      "",
      `The ${params.month} learning report for ${params.studentName} is ready.`,
      "",
      "You can view and download it from the TechCiti parent portal.",
      "",
      `Thank you for your continued support.`,
      "",
      `— ${brand}`,
    ].join("\n");
  },
} as const;