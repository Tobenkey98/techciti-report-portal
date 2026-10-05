import multer from "multer";
import { env } from "../config/env.js";
import { badRequest } from "../lib/errors.js";

const ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls"] as const;

/**
 * Bulk-import uploads are parsed in memory: files are tiny (a few thousand rows
 * at most) and never written to disk, which removes a whole class of problems
 * (temp file cleanup, path traversal, stale uploads).
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.uploadMaxBytes,
    files: 1,
    fields: 12,
  },
  fileFilter: (_req, file, callback) => {
    const name = file.originalname.toLowerCase();
    const ok = ALLOWED_EXTENSIONS.some((extension) => name.endsWith(extension));
    if (!ok) {
      callback(
        badRequest(`Unsupported file type. Upload a .csv, .xlsx or .xls file.`),
      );
      return;
    }
    callback(null, true);
  },
});

/** `upload.single("file")` — rejects anything that is not one CSV/XLSX file. */
export const singleFileUpload = upload.single("file");