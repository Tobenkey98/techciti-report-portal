import ExcelJS from "exceljs";
import {
  AGE_GROUP_LABELS,
  LEVEL_LABELS,
  RATING_LABELS,
  STATUS_LABELS,
} from "../../../config/constants.js";
import { formatDate, formatMonth } from "../../../lib/month.js";
import type { ReportWithContext } from "../../../lib/serialize.js";

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFF5733" },
};

/**
 * Streams the report rows into an .xlsx workbook.
 *
 * One sheet per month keeps it readable, plus a summary sheet with the counts
 * an admin would otherwise have to compute by hand.
 */
export async function buildReportsWorkbook(
  reports: ReportWithContext[],
  title = "TechCiti Tutor Reports",
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TechCiti Tutor Report Portal";
  workbook.created = new Date();

  const columns = [
    { header: "Month", key: "month", width: 12 },
    { header: "Student", key: "student", width: 24 },
    { header: "Age group", key: "ageGroup", width: 12 },
    { header: "Course", key: "course", width: 24 },
    { header: "Level", key: "level", width: 14 },
    { header: "Tutor", key: "tutor", width: 22 },
    { header: "Status", key: "status", width: 16 },
    { header: "Progress", key: "rating", width: 16 },
    { header: "Sessions held", key: "sessionsHeld", width: 14 },
    { header: "Sessions attended", key: "sessionsAttended", width: 18 },
    { header: "Topics covered", key: "topics", width: 60 },
    { header: "General feedback", key: "feedback", width: 60 },
    { header: "Tutor comment", key: "comment", width: 50 },
    { header: "Continuity needed", key: "continuity", width: 16 },
    { header: "Continuity note", key: "continuityNote", width: 40 },
    { header: "Submitted", key: "submittedAt", width: 14 },
    { header: "Reviewed", key: "reviewedAt", width: 14 },
  ];

  const byMonth = new Map<string, ReportWithContext[]>();
  for (const report of reports) {
    const bucket = byMonth.get(report.month) ?? [];
    bucket.push(report);
    byMonth.set(report.month, bucket);
  }

  for (const month of [...byMonth.keys()].sort().reverse()) {
    const sheet = workbook.addWorksheet(month, {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    sheet.columns = columns;

    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = HEADER_FILL;
    header.alignment = { vertical: "middle" };
    header.height = 22;

    for (const report of byMonth.get(month) ?? []) {
      const row = sheet.addRow({
        month: report.month,
        student: report.student.fullName,
        ageGroup: AGE_GROUP_LABELS[report.student.ageGroup] ?? report.student.ageGroup,
        course: report.course.name,
        level: LEVEL_LABELS[report.level] ?? report.level,
        tutor: report.tutor.fullName,
        status: STATUS_LABELS[report.status] ?? report.status,
        rating: report.progressRating ? RATING_LABELS[report.progressRating] : "",
        sessionsHeld: report.sessionsHeld ?? "",
        sessionsAttended: report.sessionsAttended ?? "",
        topics: report.topicsCovered,
        feedback: report.generalFeedback,
        comment: report.tutorComment,
        continuity: report.continuityNeeded ? "Yes" : "No",
        continuityNote: report.continuityNote ?? "",
        submittedAt: formatDate(report.submittedAt) ?? "",
        reviewedAt: formatDate(report.reviewedAt) ?? "",
      });
      row.alignment = { vertical: "top", wrapText: true };
    }

    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  }

  // -------------------------------------------------------------- summary --
  const summary = workbook.addWorksheet("Summary");
  summary.columns = [
    { header: "Month", key: "month", width: 18 },
    { header: "Month name", key: "label", width: 20 },
    { header: "Reports", key: "total", width: 12 },
    { header: "Draft", key: "draft", width: 10 },
    { header: "Submitted", key: "submitted", width: 12 },
    { header: "Reviewed", key: "reviewed", width: 12 },
    { header: "Needs revision", key: "revision", width: 16 },
  ];

  const summaryHeader = summary.getRow(1);
  summaryHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
  summaryHeader.fill = HEADER_FILL;

  for (const month of [...byMonth.keys()].sort().reverse()) {
    const rows = byMonth.get(month) ?? [];
    summary.addRow({
      month,
      label: formatMonth(month),
      total: rows.length,
      draft: rows.filter((r) => r.status === "DRAFT").length,
      submitted: rows.filter((r) => r.status === "SUBMITTED").length,
      reviewed: rows.filter((r) => r.status === "REVIEWED").length,
      revision: rows.filter((r) => r.status === "NEEDS_REVISION").length,
    });
  }

  summary.addRow({});
  summary.addRow({ month: title, label: `Exported ${formatDate(new Date().toISOString()) ?? ""}` });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}