import {
  AGE_GROUP_LABELS,
  LEVEL_LABELS,
  RATING_LABELS,
  STATUS_LABELS,
} from "../../../config/constants.js";
import { formatDate, formatDateTime, formatMonth } from "../../../lib/month.js";
import type { ReportWithContext } from "../../../lib/serialize.js";

/**
 * One shared, brand-styled HTML template for both screen preview and PDF.
 *
 * Brand colours are inlined as CSS custom properties so the PDF renderer and
 * the admin app's print preview always agree. Keep the markup print-safe:
 * no external assets, no JavaScript, page breaks on section boundaries.
 */
export function renderReportHtml(report: ReportWithContext, company = "TechCiti"): string {
  const label = (map: Record<string, string>, key: string | null | undefined): string =>
    key ? (map[key] ?? key) : "—";

  const paragraph = (text: string | null | undefined): string =>
    text && text.trim()
      ? `<p>${escapeHtml(text).replace(/\r?\n/g, "<br />")}</p>`
      : `<p class="empty">Not provided</p>`;

  const ratingClass = (() => {
    switch (report.progressRating) {
      case "EXCELLENT":
      case "GOOD":
        return "good";
      case "FAIR":
        return "fair";
      default:
        return "poor";
    }
  })();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(report.student.fullName)} — ${escapeHtml(formatMonth(report.month))}</title>
<style>
  :root {
    --primary: #FF5733;
    --primary-soft: #FFF1EC;
    --foreground: #1F2937;
    --muted: #6B7280;
    --border: #E5E7EB;
    --success: #4CAF50;
    --warning: #F59E0B;
    --danger: #DC2626;
  }
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Manrope", "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: var(--foreground);
    font-size: 12px;
    line-height: 1.6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .masthead {
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px; padding-bottom: 14px; border-bottom: 3px solid var(--primary);
  }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand-mark {
    width: 38px; height: 38px; border-radius: 12px; background: var(--primary);
    color: #fff; display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 17px;
  }
  .brand-name { font-size: 19px; font-weight: 800; letter-spacing: -0.02em; }
  .brand-sub { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.12em; }
  .month-tag {
    background: var(--primary-soft); color: var(--primary); font-weight: 700;
    padding: 7px 14px; border-radius: 999px; font-size: 12px; white-space: nowrap;
  }
  h1 { font-size: 22px; margin: 20px 0 4px; letter-spacing: -0.02em; }
  .subtitle { color: var(--muted); margin: 0 0 18px; font-size: 13px; }
  .facts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 22px; }
  .fact { border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; }
  .fact dt { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); margin: 0 0 3px; }
  .fact dd { margin: 0; font-weight: 700; font-size: 12.5px; }
  section { margin-bottom: 18px; break-inside: avoid; }
  .section-title {
    display: flex; align-items: center; gap: 8px;
    font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--primary); margin: 0 0 8px; padding-bottom: 6px; border-bottom: 1px solid var(--border);
  }
  .section-title::before { content: ""; width: 3px; height: 13px; background: var(--primary); border-radius: 2px; }
  p { margin: 0 0 6px; white-space: pre-wrap; }
  p.empty { color: var(--muted); font-style: italic; }
  .rating {
    display: inline-block; padding: 5px 14px; border-radius: 999px;
    font-weight: 800; font-size: 12px;
  }
  .rating.good { background: #E8F5E9; color: var(--success); }
  .rating.fair { background: #FEF3E2; color: var(--warning); }
  .rating.poor { background: #FDE8E8; color: var(--danger); }
  .status {
    display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 10px;
    font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
    background: var(--primary-soft); color: var(--primary);
  }
  .callout {
    background: var(--primary-soft); border-left: 3px solid var(--primary);
    padding: 10px 14px; border-radius: 0 10px 10px 0; font-weight: 600;
  }
  .footer {
    margin-top: 26px; padding-top: 12px; border-top: 1px solid var(--border);
    display: flex; justify-content: space-between; gap: 12px;
    font-size: 9.5px; color: var(--muted);
  }
  @media print { body { font-size: 11.5px; } }
</style>
</head>
<body>
  <header class="masthead">
    <div class="brand">
      <div class="brand-mark">T</div>
      <div>
        <div class="brand-name">Tech<span style="color: var(--primary)">Citi</span></div>
        <div class="brand-sub">Monthly Tutor Report</div>
      </div>
    </div>
    <div class="month-tag">${escapeHtml(formatMonth(report.month))}</div>
  </header>

  <h1>${escapeHtml(report.student.fullName)}</h1>
  <p class="subtitle">${escapeHtml(report.course.name)} · ${escapeHtml(label(LEVEL_LABELS, report.level))} level</p>

  <dl class="facts">
    <div class="fact"><dt>Student</dt><dd>${escapeHtml(report.student.fullName)}</dd></div>
    <div class="fact"><dt>Age group</dt><dd>${escapeHtml(label(AGE_GROUP_LABELS, report.student.ageGroup))}</dd></div>
    <div class="fact"><dt>Course</dt><dd>${escapeHtml(report.course.name)}</dd></div>
    <div class="fact"><dt>Tutor</dt><dd>${escapeHtml(report.tutor.fullName)}</dd></div>
  </dl>

  <section>
    <h2 class="section-title">Progress this month</h2>
    <span class="rating ${ratingClass}">${escapeHtml(label(RATING_LABELS, report.progressRating))}</span>
    ${
      report.sessionsHeld !== null || report.sessionsAttended !== null
        ? `<p style="margin-top:10px">Sessions held: <strong>${report.sessionsHeld ?? "—"}</strong> · Sessions attended: <strong>${report.sessionsAttended ?? "—"}</strong></p>`
        : ""
    }
  </section>

  <section>
    <h2 class="section-title">Topics covered</h2>
    ${paragraph(report.topicsCovered)}
  </section>

  <section>
    <h2 class="section-title">General feedback</h2>
    ${paragraph(report.generalFeedback)}
  </section>

  <section>
    <h2 class="section-title">Tutor comment</h2>
    ${paragraph(report.tutorComment)}
  </section>

  <section>
    <h2 class="section-title">Continuity</h2>
    ${
      report.continuityNeeded
        ? `<p class="callout">This learner needs continuity support.</p>${paragraph(report.continuityNote)}`
        : `<p>No continuity support needed this month.</p>`
    }
  </section>

  ${
    report.revisionNote
      ? `<section><h2 class="section-title">Reviewer note</h2><div class="callout">${escapeHtml(report.revisionNote)}</div></section>`
      : ""
  }

  <footer class="footer">
    <span>Status: <span class="status">${escapeHtml(label(STATUS_LABELS, report.status))}</span></span>
    <span>Submitted ${escapeHtml(formatDate(report.submittedAt) ?? "—")} · Reviewed ${escapeHtml(formatDate(report.reviewedAt) ?? "—")}</span>
  </footer>
</body>
</html>`;
}

/** Plain-text version used inside the .docx and as a WhatsApp preview. */
export function renderReportPlainText(report: ReportWithContext): string {
  const lines = [
    "TECHCITI — MONTHLY TUTOR REPORT",
    `Month: ${formatMonth(report.month)}`,
    "",
    `Student:   ${report.student.fullName}`,
    `Age group: ${AGE_GROUP_LABELS[report.student.ageGroup] ?? report.student.ageGroup}`,
    `Course:    ${report.course.name}`,
    `Level:     ${LEVEL_LABELS[report.level] ?? report.level}`,
    `Tutor:     ${report.tutor.fullName}`,
    "",
    `PROGRESS: ${RATING_LABELS[report.progressRating ?? ""] ?? "Not rated"}`,
    ...(report.sessionsHeld !== null || report.sessionsAttended !== null
      ? [`Sessions held: ${report.sessionsHeld ?? "—"}, attended: ${report.sessionsAttended ?? "—"}`]
      : []),
    "",
    "TOPICS COVERED",
    report.topicsCovered || "—",
    "",
    "GENERAL FEEDBACK",
    report.generalFeedback || "—",
    "",
    "TUTOR COMMENT",
    report.tutorComment || "—",
    "",
    "CONTINUITY",
    report.continuityNeeded ? `Required: ${report.continuityNote || "—"}` : "Not required",
    "",
    `Status: ${STATUS_LABELS[report.status] ?? report.status}`,
    `Submitted: ${formatDateTime(report.submittedAt) ?? "—"}`,
    `Reviewed: ${formatDateTime(report.reviewedAt) ?? "—"}`,
  ];
  return lines.join("\n");
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Filesystem-safe base name for downloads. */
export function reportFileName(report: ReportWithContext, extension: string): string {
  const safeStudent = report.student.fullName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  const safeCourse = report.course.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  return `TechCiti-${report.month}-${safeStudent}-${safeCourse}.${extension}`;
}