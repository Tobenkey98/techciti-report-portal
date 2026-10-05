"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  XCircle,
} from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { bulkImport } from "@/lib/api";
import type { ImportKind, ImportPreview } from "@/lib/types";
import { cn } from "@/lib/utils";

const TEMPLATES: Record<ImportKind, string> = {
  instructors: "Full name,Email,Phone,Subjects\nAmaka Obi,amaka.obi@techciti.ng,08031152201,\"Mathematics, Further Mathematics\"",
  students:
    "Full name,Grade,Gender,Parent name,Parent phone\nChidera Nwosu,Primary 5,Female,Mrs Ngozi Nwosu,08032241877",
};

export function ImportView() {
  const toast = useToast();
  const [kind, setKind] = React.useState<ImportKind>("instructors");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<Record<string, string>[]>([]);
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [committing, setCommitting] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setParsing(true);
    setFileName(file.name);
    setPreview(null);

    try {
      const parsed = await parseFile(file);
      if (parsed.length === 0) {
        toast.error({
          title: "No rows found",
          description: "The file looks empty. Check it has a header row and at least one record.",
        });
        setRows([]);
        return;
      }
      setRows(parsed);
      const result = await bulkImport.preview(kind, parsed);
      setPreview(result);
    } catch (error) {
      toast.error({
        title: "Could not read file",
        description: error instanceof Error ? error.message : "Unsupported file.",
      });
      setRows([]);
    } finally {
      setParsing(false);
    }
  }

  async function handleCommit() {
    setCommitting(true);
    try {
      const result = await bulkImport.commit(kind, rows);
      toast.success({
        title: `Imported ${result.created} ${kind}`,
        description:
          result.skipped > 0
            ? `${result.skipped} row${result.skipped === 1 ? "" : "s"} skipped because of errors.`
            : "Everything landed cleanly.",
      });
      setConfirmOpen(false);
      setRows([]);
      setPreview(null);
      setFileName(null);
      if (inputRef.current) inputRef.current.value = "";
    } finally {
      setCommitting(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATES[kind]], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${kind}-template.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const columns = bulkImport.columnsFor(kind);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk import"
        description="Upload a CSV or Excel file to add many tutors or students at once. Rows are checked before anything is saved."
        actions={
          <Button variant="secondary" onClick={downloadTemplate}>
            <Download aria-hidden />
            Download template
          </Button>
        }
      />

      <Tabs
        value={kind}
        onValueChange={(value) => {
          setKind(value as ImportKind);
          setPreview(null);
          setRows([]);
          setFileName(null);
        }}
      >
        <TabsList>
          <TabsTrigger value="instructors">Tutors</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
        </TabsList>

        <TabsContent value="instructors">
          <ImportPanel
            kind="instructors"
            columns={columns}
            fileName={fileName}
            parsing={parsing}
            preview={preview}
            onFile={handleFile}
            inputRef={inputRef}
          />
        </TabsContent>
        <TabsContent value="students">
          <ImportPanel
            kind="students"
            columns={columns}
            fileName={fileName}
            parsing={parsing}
            preview={preview}
            onFile={handleFile}
            inputRef={inputRef}
          />
        </TabsContent>
      </Tabs>

      {preview && preview.rows.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold">Preview</h2>
              <Badge variant="success">
                <CheckCircle2 className="size-3" aria-hidden />
                {preview.validCount} ready
              </Badge>
              {preview.errorCount > 0 ? (
                <Badge variant="danger">
                  <XCircle className="size-3" aria-hidden />
                  {preview.errorCount} with errors
                </Badge>
              ) : null}
            </div>
            <Button
              disabled={preview.validCount === 0}
              onClick={() => setConfirmOpen(true)}
            >
              Import {preview.validCount} {preview.validCount === 1 ? "row" : "rows"}
            </Button>
          </div>

          <div className="max-h-[520px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-14">Row</TableHead>
                  {columns.map((column) => (
                    <TableHead key={column}>{column}</TableHead>
                  ))}
                  <TableHead>Issues</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((row) => (
                  <TableRow
                    key={row.rowNumber}
                    className={cn(row.errors.length > 0 && "bg-danger-soft/50")}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.rowNumber}
                    </TableCell>
                    {columns.map((column) => (
                      <TableCell key={column} className="max-w-[220px] truncate text-sm">
                        {(row.raw[column] ?? "").trim() || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    ))}
                    <TableCell>
                      {row.errors.length > 0 ? (
                        <ul className="space-y-1">
                          {row.errors.map((error) => (
                            <li
                              key={error}
                              className="flex items-start gap-1.5 text-xs font-medium text-danger"
                            >
                              <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
                              {error}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <CheckCircle2 className="size-4 text-success" aria-label="Valid" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Import ${preview?.validCount ?? 0} ${kind}?`}
        description={
          preview && preview.errorCount > 0
            ? `${preview.errorCount} row(s) will be skipped because they contain errors. Everything else will be added.`
            : "These rows passed validation and will be added straight away."
        }
        confirmLabel="Import now"
        loading={committing}
        onConfirm={handleCommit}
      />
    </div>
  );
}

function ImportPanel({
  kind,
  columns,
  fileName,
  parsing,
  preview,
  onFile,
  inputRef,
}: {
  kind: ImportKind;
  columns: string[];
  fileName: string | null;
  parsing: boolean;
  preview: ImportPreview | null;
  onFile: (file: File) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [dragging, setDragging] = React.useState(false);

  return (
    <Card className="overflow-hidden">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) void onFile(file);
        }}
        className={cn(
          "flex flex-col items-center gap-4 border-b border-border p-8 text-center transition-colors sm:p-12",
          dragging && "bg-primary-soft",
        )}
      >
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <FileSpreadsheet className="size-7" aria-hidden />
        </span>

        <div className="space-y-1.5">
          <h2 className="text-lg font-bold">Upload your {kind} file</h2>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
            CSV or Excel (.xlsx). The first row must contain the column headers:
            <span className="mt-1 block font-semibold text-foreground">
              {columns.join(", ")}
            </span>
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <input
            ref={inputRef}
            id={`upload-${kind}`}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
          <Button asChild loading={parsing}>
            <label htmlFor={`upload-${kind}`} className="cursor-pointer">
              <Upload aria-hidden />
              {fileName ? "Choose a different file" : `Choose ${kind} file`}
            </label>
          </Button>
          {fileName ? (
            <p className="text-sm font-medium text-muted-foreground">
              Selected: <span className="text-foreground">{fileName}</span>
            </p>
          ) : null}
        </div>
      </div>

      {!fileName && !parsing ? (
        <EmptyState
          size="sm"
          icon={<Upload className="size-5" aria-hidden />}
          title="No file selected"
          description="Upload a file to see a preview with validation before anything is saved."
        />
      ) : null}
    </Card>
  );
}

/* --------------------------------- Parsing --------------------------------- */

/** Reads CSV natively; uses SheetJS for .xlsx/.xls (loaded on demand). */
async function parseFile(file: File): Promise<Record<string, string>[]> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv") || file.type === "text/csv") {
    return parseCsv(await file.text());
  }

  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      inQuotes = true;
    } else if (character === ",") {
      current.push(field);
      field = "";
    } else if (character === "\n") {
      current.push(field);
      rows.push(current);
      current = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (field.length > 0 || current.length > 0) {
    current.push(field);
    rows.push(current);
  }

  const [header, ...body] = rows.filter((row) => row.some((cell) => cell.trim() !== ""));
  if (!header) return [];

  return body.map((row) =>
    header.reduce<Record<string, string>>((accumulator, key, index) => {
      accumulator[key.trim()] = (row[index] ?? "").trim();
      return accumulator;
    }, {}),
  );
}