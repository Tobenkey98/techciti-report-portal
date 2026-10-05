import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { env } from "../../../config/env.js";
import { ApiError } from "../../../lib/errors.js";
import { logger } from "../../../lib/logger.js";
import { AGE_GROUP_LABELS, LEVEL_LABELS, RATING_LABELS, STATUS_LABELS } from "../../../config/constants.js";
import { formatDate } from "../../../lib/month.js";
import { renderReportHtml, reportFileName } from "./report-template.js";
import type { ReportWithContext } from "../../../lib/serialize.js";

const PRIMARY = "FF5733";
const BORDER = { color: "E5E7EB", style: BorderStyle.SINGLE, size: 1 };

/* -------------------------------------------------------------------------- */
/*                                   Word                                     */
/* -------------------------------------------------------------------------- */

function text(value: string, options: { bold?: boolean; size?: number; color?: string } = {}) {
  return new TextRun({
    text: value,
    bold: options.bold ?? false,
    size: options.size ?? 22,
    color: options.color,
  });
}

function heading(value: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    children: [text(value, { bold: true, size: 22, color: PRIMARY })],
  });
}

function body(value: string | null | undefined): Paragraph {
  return new Paragraph({
    spacing: { after: 160 },
    children: [text(value && value.trim() ? value : "Not provided", { color: value ? undefined : "6B7280" })],
  });
}

function factRow(cells: string[]): TableRow {
  return new TableRow({
    children: cells.map(
      (cell) =>
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          borders: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
          margins: { top: 120, bottom: 120, left: 140, right: 140 },
          children: [new Paragraph({ children: [text(cell, { bold: true, size: 20 })] })],
        }),
    ),
  });
}

/** Builds a .docx with the same content and branding as the HTML/PDF report. */
export async function buildDocx(report: ReportWithContext): Promise<Buffer> {
  const facts = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      factRow(["Student", report.student.fullName, "Course", report.course.name]),
      factRow([
        "Age group",
        AGE_GROUP_LABELS[report.student.ageGroup] ?? report.student.ageGroup,
        "Tutor",
        report.tutor.fullName,
      ]),
      factRow([
        "Level",
        LEVEL_LABELS[report.level] ?? report.level,
        "Status",
        STATUS_LABELS[report.status] ?? report.status,
      ]),
      factRow(["Progress", RATING_LABELS[report.progressRating ?? ""] ?? "Not rated", "Month", report.month]),
    ],
  });

  const children: Paragraph[] = [
    new Paragraph({
      spacing: { after: 60 },
      children: [
        text("TechCiti", { bold: true, size: 40, color: PRIMARY }),
        text("  Monthly Tutor Report", { size: 22, color: "6B7280" }),
      ],
    }),
    new Paragraph({
      spacing: { after: 240 },
      border: { bottom: { color: PRIMARY, style: BorderStyle.SINGLE, size: 12 } },
      children: [text(`Reporting period: ${report.month}`, { size: 20, color: "6B7280" })],
    }),
  ];

  // The fact table is not a Paragraph, so it is inserted separately below.
  const doc = new Document({
    creator: "TechCiti Tutor Report Portal",
    title: `Report ${report.id}`,
    description: `${report.student.fullName} — ${report.course.name} — ${report.month}`,
    sections: [
      {
        properties: {
          page: { margin: { top: 1000, right: 900, bottom: 1000, left: 900 } },
        },
        children: [
          ...children,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          facts as any,
          heading("Progress this month"),
          body(RATING_LABELS[report.progressRating ?? ""] ?? "Not rated"),
          ...(report.sessionsHeld !== null || report.sessionsAttended !== null
            ? [body(`Sessions held: ${report.sessionsHeld ?? "—"} · Attended: ${report.sessionsAttended ?? "—"}`)]
            : []),
          heading("Topics covered"),
          body(report.topicsCovered),
          heading("General feedback"),
          body(report.generalFeedback),
          heading("Tutor comment"),
          body(report.tutorComment),
          heading("Continuity"),
          body(
            report.continuityNeeded
              ? `Needs continuity support: ${report.continuityNote || "—"}`
              : "No continuity support needed this month.",
          ),
          ...(report.revisionNote ? [heading("Reviewer note"), body(report.revisionNote)] : []),
          new Paragraph({
            spacing: { before: 400 },
            border: { top: { color: "E5E7EB", style: BorderStyle.SINGLE, size: 6 } },
            children: [
              text(
                `Submitted ${formatDate(report.submittedAt) ?? "—"} · Reviewed ${formatDate(report.reviewedAt) ?? "—"}`,
                { size: 18, color: "6B7280" },
              ),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

/* -------------------------------------------------------------------------- */
/*                                    PDF                                     */
/* -------------------------------------------------------------------------- */

/** Candidate Chrome/Edge binaries when Puppeteer has no bundled Chromium. */
const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

async function resolveExecutable(): Promise<string | null> {
  if (env.PUPPETEER_EXECUTABLE_PATH) {
    return fs.existsSync(env.PUPPETEER_EXECUTABLE_PATH) ? env.PUPPETEER_EXECUTABLE_PATH : null;
  }

  // A bundled Chromium from `npx puppeteer browsers install chrome` shows up here.
  const cacheRoot = path.join(os.homedir(), ".cache", "puppeteer", "chrome");
  if (fs.existsSync(cacheRoot)) {
    for (const entry of fs.readdirSync(cacheRoot)) {
      const candidate = path.join(
        cacheRoot,
        entry,
        "chrome-win64",
        "chrome.exe",
      );
      if (fs.existsSync(candidate)) return candidate;
      const mac = path.join(cacheRoot, entry, "chrome-mac-x64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing");
      if (fs.existsSync(mac)) return mac;
    }
  }

  return CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate)) ?? null;
}

/**
 * Renders the branded HTML report to PDF.
 *
 * `puppeteer` is an optional dependency and its Chromium download is skipped on
 * restricted networks. If no browser is available the endpoint returns a clear,
 * actionable 503 rather than a generic failure.
 */
export async function buildPdf(report: ReportWithContext): Promise<Buffer> {
  const executablePath = await resolveExecutable();

  if (!executablePath) {
    throw new ApiError(
      "BAD_REQUEST",
      "PDF generation is not available on this server because no Chrome/Chromium binary was found. " +
        "Either install one (e.g. `npx puppeteer browsers install chrome`) or set PUPPETEER_EXECUTABLE_PATH in .env. " +
        "You can still print the on-screen report or download the Word version.",
    );
  }

  let puppeteer: typeof import("puppeteer");
  try {
    puppeteer = (await import("puppeteer")).default;
  } catch {
    throw new ApiError(
      "BAD_REQUEST",
      "PDF generation needs the optional `puppeteer` package. Run `npm install puppeteer` to enable it.",
    );
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    // Inline styles + system fonts only, so no network request is needed.
    await page.setContent(renderReportHtml(report), { waitUntil: "load" });
    const buffer = await page.pdf({
      format: "a4",
      printBackground: true,
      margin: { top: "18mm", right: "16mm", bottom: "18mm", left: "16mm" },
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `<div style="font-size:8px;color:#6B7280;width:100%;padding:0 16mm;display:flex;justify-content:space-between;">
        <span>TechCiti Tutor Report</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>`,
    });
    return Buffer.from(buffer);
  } finally {
    await browser.close().catch((error) => logger.warn({ err: error }, "failed to close browser"));
  }
}

export { reportFileName, renderReportHtml };