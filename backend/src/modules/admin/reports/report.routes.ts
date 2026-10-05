import { Router } from "express";
import { asyncHandler } from "../../../lib/async-handler.js";
import { validate } from "../../../middleware/validate.js";
import { idParamSchema } from "../../../schemas/common.js";
import { auditAdmin } from "../../../lib/activity-log.js";
import { documentLimiter } from "../../../middleware/rate-limit.js";
import { currentMonth, formatMonth } from "../../../lib/month.js";
import * as service from "./report.service.js";
import { buildDocx, buildPdf, reportFileName } from "./report-documents.js";
import { renderReportHtml } from "./report-template.js";
import { buildReportsWorkbook } from "../exports/excel-export.js";
import {
  listReportsQuerySchema,
  requestRevisionBodySchema,
  reportsExportQuerySchema,
  reviewBodySchema,
} from "./report.schema.js";

/** `/api/admin/reports` — read every report and act on it. */
export const reportsRouter: Router = Router();

reportsRouter.get(
  "/",
  validate({ query: listReportsQuerySchema }),
  asyncHandler(async (req, res) => {
    const data = await service.listReports(req.query as never);
    res.json({ success: true, data });
  }),
);

/** GET /api/admin/reports/export.xlsx — filtered Excel export. */
reportsRouter.get(
  "/export.xlsx",
  validate({ query: reportsExportQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as never as Parameters<typeof service.listAllForExport>[0];
    const reports = await service.listAllForExport(query);
    const buffer = await buildReportsWorkbook(reports);

    const month = query.month && query.month !== "all" ? `${query.month}-` : "";
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="TechCiti-reports-${month || "all"}.xlsx"`);
    res.send(buffer);
  }),
);

/** GET /api/admin/reports/status-counts?month=YYYY-MM — filter bar counters. */
reportsRouter.get(
  "/status-counts",
  asyncHandler(async (req, res) => {
    const month = typeof req.query.month === "string" ? req.query.month : currentMonth();
    const data = await service.statusCounts(month);
    res.json({ success: true, data });
  }),
);

reportsRouter.get(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.getReport(req.params.id!);
    res.json({ success: true, data });
  }),
);

/** GET /api/admin/reports/:id/activity — audit trail for this report. */
reportsRouter.get(
  "/:id/activity",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.reportActivity(req.params.id!);
    res.json({ success: true, data });
  }),
);

/** GET /api/admin/reports/:id/html — the printable markup (preview + print). */
reportsRouter.get(
  "/:id/html",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const report = await service.getReport(req.params.id!);
    res.type("html").send(renderReportHtml(report));
  }),
);

/** GET /api/admin/reports/:id/document.pdf */
reportsRouter.get(
  "/:id/document.pdf",
  documentLimiter,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const report = await service.getReport(req.params.id!);
    const buffer = await buildPdf(report);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${reportFileName(report, "pdf")}"`);
    res.send(buffer);
  }),
);

/** GET /api/admin/reports/:id/document.docx */
reportsRouter.get(
  "/:id/document.docx",
  documentLimiter,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const report = await service.getReport(req.params.id!);
    const buffer = await buildDocx(report);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${reportFileName(report, "docx")}"`);
    res.send(buffer);
  }),
);

/** POST /api/admin/reports/:id/review — mark as reviewed. */
reportsRouter.post(
  "/:id/review",
  validate({ params: idParamSchema, body: reviewBodySchema }),
  asyncHandler(async (req, res) => {
    const data = await service.markReviewed(req.params.id!, req.body, req.admin!.id);
    await auditAdmin(req.admin!, "report.reviewed", "report", req.params.id!, {
      month: data.month,
      note: req.body.note ?? null,
    });
    res.json({ success: true, data });
  }),
);

/** POST /api/admin/reports/:id/request-revision — send back with a note. */
reportsRouter.post(
  "/:id/request-revision",
  validate({ params: idParamSchema, body: requestRevisionBodySchema }),
  asyncHandler(async (req, res) => {
    const data = await service.requestRevision(req.params.id!, req.body);
    await auditAdmin(req.admin!, "report.revision_requested", "report", req.params.id!, {
      month: data.month,
      note: req.body.note,
    });
    res.json({ success: true, data });
  }),
);

/** GET /api/admin/reports/:id/reminder-message — WhatsApp text for the tutor. */
reportsRouter.get(
  "/:id/reminder-message",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const report = await service.getReport(req.params.id!);
    const { whatsappLink } = await import("../../../lib/whatsapp.js");
    const message = `Hi ${report.tutor.fullName}, your ${formatMonth(report.month)} report for ${report.student.fullName} (${report.course.name}) needs an update: ${report.revisionNote ?? "please review the feedback"}.`;
    res.json({
      success: true,
      data: { message, whatsappLink: whatsappLink(report.tutor.phone, message) },
    });
  }),
);