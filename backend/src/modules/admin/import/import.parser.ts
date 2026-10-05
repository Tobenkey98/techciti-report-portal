import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { badRequest } from "../../../lib/errors.js";
import { AGE_GROUPS, LEVELS } from "../../../config/constants.js";

export type ImportType = "tutors" | "students" | "assignments";

export interface TemplateColumn {
  key: string;
  label: string;
  required: boolean;
  example: string;
  help?: string;
}

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * Column definitions double as the contract for the downloadable template,
 * so the sample file and the importer can never drift apart.
 */
export const IMPORT_TEMPLATES: Record<ImportType, { columns: TemplateColumn[]; title: string }> = {
  tutors: {
    title: "Tutors",
    columns: [
      { key: "Full name", label: "Full name", required: true, example: "Amaka Obi" },
      { key: "Email", label: "Email", required: false, example: "amaka.obi@example.com" },
      { key: "Phone", label: "Phone", required: true, example: "+2348012345678", help: "Include the country code for WhatsApp links." },
    ],
  },
  students: {
    title: "Students",
    columns: [
      { key: "Full name", label: "Full name", required: true, example: "Zainab Balogun" },
      { key: "Age group", label: "Age group", required: true, example: "KIDS", help: `One of ${AGE_GROUPS.join(", ")}.` },
      { key: "Parent name", label: "Parent name", required: false, example: "Mrs Fatima Balogun" },
      { key: "Parent phone", label: "Parent phone", required: false, example: "+2348023456789" },
      { key: "Parent email", label: "Parent email", required: false, example: "parent@example.com" },
    ],
  },
  assignments: {
    title: "Assignments",
    columns: [
      { key: "Tutor", label: "Tutor", required: true, example: "Amaka Obi", help: "Must match an existing tutor's full name." },
      { key: "Student", label: "Student", required: true, example: "Zainab Balogun", help: "Must match an existing student's full name." },
      { key: "Course", label: "Course", required: true, example: "Python Fundamentals", help: "Must match an existing course name." },
      { key: "Level", label: "Level", required: true, example: "BEGINNER", help: `One of ${LEVELS.join(", ")}.` },
    ],
  },
};

/** Normalises a header cell: lower case, underscores/spaces collapsed. */
function normaliseHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/﻿/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
}

/** Accepts `full name`, `Full name`, `full_name`, `FullName` alike. */
function canonicalKey(value: unknown): string {
  const normalised = normaliseHeader(value);
  for (const column of Object.values(IMPORT_TEMPLATES).flatMap((template) => template.columns)) {
    if (normaliseHeader(column.key) === normalised) return column.key;
  }
  return String(value ?? "").trim();
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

/**
 * Turns an uploaded CSV/XLSX buffer into plain row objects keyed by the
 * canonical column labels from the template.
 */
export function parseSpreadsheet(buffer: Buffer, filename: string, type: ImportType): ParsedSheet {
  const isCsv = filename.toLowerCase().endsWith(".csv");
  let matrix: unknown[][];

  if (isCsv) {
    matrix = parse(buffer, {
      columns: false,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
      bom: true,
    }) as unknown[][];
  } else {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw badRequest("That workbook has no sheets.");
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw badRequest("That workbook has no readable sheet.");
    matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
  }

  // Drop fully blank rows that spreadsheets often leave behind.
  matrix = matrix.filter((row) => row.some((cell) => cellToString(cell) !== ""));

  if (matrix.length === 0) {
    throw badRequest("That file is empty. Download a template to see the expected columns.");
  }

  const headers = (matrix[0] ?? []).map(canonicalKey);
  const expected = IMPORT_TEMPLATES[type].columns.map((column) => column.key);

  const missing = expected.filter(
    (key) => !headers.some((header) => normaliseHeader(header) === normaliseHeader(key)),
  );
  if (missing.length > 0) {
    throw badRequest(
      `That file is missing required column(s): ${missing.join(", ")}. Download the template and copy your data into it.`,
      { missingColumns: missing.join(", ") },
    );
  }

  const rows = matrix.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      record[header] = cellToString(row[index]);
    });
    // Fill the canonical keys so downstream code can rely on them existing.
    for (const key of expected) {
      if (!(key in record)) record[key] = "";
    }
    return record;
  });

  return { headers, rows };
}

/** Builds an .xlsx template workbook for the given import type. */
export function buildTemplateWorkbook(type: ImportType): Promise<Buffer> {
  const template = IMPORT_TEMPLATES[type];
  const workbook = XLSX.utils.book_new();

  const headerRow = template.columns.map((column) => column.label);
  const exampleRow = template.columns.map((column) => column.example);
  const helpRow = template.columns.map((column) => column.help ?? "");

  const sheet = XLSX.utils.aoa_to_sheet([headerRow, helpRow, exampleRow]);
  sheet["!cols"] = template.columns.map((column) => ({ wch: Math.max(14, column.key.length + 4) }));

  XLSX.utils.book_append_sheet(workbook, sheet, template.title);
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return Promise.resolve(buffer);
}