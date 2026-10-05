import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../../lib/async-handler.js";
import { validate } from "../../../middleware/validate.js";
import { singleFileUpload } from "../../../middleware/upload.js";
import { importLimiter } from "../../../middleware/rate-limit.js";
import { auditAdmin } from "../../../lib/activity-log.js";
import { badRequest } from "../../../lib/errors.js";
import { buildTemplateWorkbook, parseSpreadsheet, type ImportType } from "./import.parser.js";
import * as service from "./import.service.js";

const typeSchema = z.object({
  type: z.enum(["tutors", "students", "assignments"]),
});

const typeParamSchema = z.object({ type: z.enum(["tutors", "students", "assignments"]) });
const templateParamSchema = z.object({ type: z.enum(["tutors", "students", "assignments"]) });

/**
 * `/api/admin/import`
 *
 * Two-step by design:
 *   1. `POST /:type?dryRun=true`  → parses and validates, returns a row-by-row
 *      preview. Nothing is written.
 *   2. `POST /:type`              → re-parses the same file and commits the valid
 *      rows inside a single transaction.
 *
 * The commit re-validates rather than trusting the preview, so a file edited in
 * between the two calls can never slip invalid data in.
 */
export const importRouter: Router = Router();

importRouter.post(
  "/:type",
  importLimiter,
  validate({ params: typeParamSchema }),
  singleFileUpload,
  asyncHandler(async (req, res) => {
    const type = req.params.type as ImportType;
    const dryRun = String(req.query.dryRun ?? "") === "true";

    if (!req.file) {
      throw badRequest("Attach a .csv or .xlsx file in the `file` field.");
    }

    const { rows } = parseSpreadsheet(req.file.buffer, req.file.originalname, type);

    if (rows.length === 0) {
      throw badRequest("That file has a header but no data rows.");
    }

    if (dryRun) {
      const preview = await service.previewImport(type, rows);
      await auditAdmin(req.admin!, "import.dry_run", type, req.file.originalname, {
        rows: preview.totalRows,
        errors: preview.errorCount,
      });
      res.json({ success: true, data: { ...preview, committed: false } });
      return;
    }

    const { preview, created, skipped } = await service.commitImport(type, rows, req.admin!.id);

    await auditAdmin(req.admin!, "import.committed", type, req.file.originalname, {
      created: created.length,
      skipped: skipped.length,
      errors: preview.errorCount,
    });

    res.status(201).json({
      success: true,
      data: {
        type,
        committed: true,
        created,
        skipped,
        createdCount: created.length,
        skippedCount: skipped.length,
        errors: preview.rows.filter((row) => row.status === "error"),
        preview,
      },
    });
  }),
);

/** GET /api/admin/import/template/:type — download a starter file. */
importRouter.get(
  "/template/:type",
  validate({ params: templateParamSchema }),
  asyncHandler(async (req, res) => {
    const type = req.params.type as ImportType;
    const buffer = await buildTemplateWorkbook(type);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="techciti-${type}-template.xlsx"`);
    res.send(buffer);
  }),
);

/** GET /api/admin/import/schema/:type — column contract for building a UI. */
importRouter.get(
  "/schema/:type",
  validate({ params: templateParamSchema }),
  asyncHandler(async (req, res) => {
    const { IMPORT_TEMPLATES } = await import("./import.parser.js");
    res.json({ success: true, data: IMPORT_TEMPLATES[req.params.type as ImportType] });
  }),
);

export { typeSchema, typeParamSchema };