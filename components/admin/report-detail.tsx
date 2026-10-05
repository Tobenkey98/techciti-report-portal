"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Printer,
  RotateCcw,
  Users,
} from "lucide-react";
import { ReportDocument } from "@/components/admin/report-document";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncData } from "@/hooks/use-async-data";
import { useToast } from "@/hooks/use-toast";
import { documents, reports as reportsApi } from "@/lib/api";
import type { ReportWithContext } from "@/lib/types";
import { formatMonth } from "@/lib/utils";

export function ReportDetail({ reportId }: { reportId: string }) {
  const toast = useToast();
  const { data, loading, error, refresh } = useAsyncData<ReportWithContext>(
    () => reportsApi.get(reportId),
    [reportId],
  );

  const [revisionOpen, setRevisionOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [noteError, setNoteError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function handleMarkReviewed() {
    setBusy(true);
    try {
      await reportsApi.markReviewed(reportId);
      toast.success({
        title: "Marked as reviewed",
        description: "This report now shows as reviewed in the reports table.",
      });
      await refresh();
    } catch (caught) {
      toast.error({
        title: "Could not update report",
        description: caught instanceof Error ? caught.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestRevision() {
    if (note.trim().length < 5) {
      setNoteError("Tell the tutor what needs to change (at least a short sentence).");
      return;
    }
    setBusy(true);
    try {
      await reportsApi.requestRevision(reportId, note);
      toast.success({
        title: "Revision requested",
        description: "The tutor will see your note when they open the report.",
      });
      setRevisionOpen(false);
      setNote("");
      setNoteError("");
      await refresh();
    } catch (caught) {
      toast.error({
        title: "Could not request revision",
        description: caught instanceof Error ? caught.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload(kind: "pdf" | "word") {
    try {
      if (kind === "pdf") {
        await documents.downloadPdf(reportId);
      } else {
        await documents.downloadWord(reportId);
      }
    } catch (caught) {
      toast.warning({
        title: kind === "pdf" ? "PDF export not connected yet" : "Word export not connected yet",
        description:
          caught instanceof Error
            ? caught.message
            : "This is where the backend document service will plug in.",
      });
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-14 w-full rounded-card" />
        <Skeleton className="h-[600px] w-full rounded-card" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-card border border-border bg-surface p-10 text-center shadow-card">
        <h1 className="text-xl font-extrabold">Report not found</h1>
        <p className="mx-auto mt-2 max-w-md text-[15px] text-muted-foreground">
          This report may have been removed. Go back to the reports list to pick another one.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/admin/reports">
            <ArrowLeft aria-hidden />
            Back to reports
          </Link>
        </Button>
      </div>
    );
  }

  const canReview = data.status !== "reviewed";

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="no-print flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon" aria-label="Back to reports">
              <Link href="/admin/reports">
                <ArrowLeft aria-hidden />
              </Link>
            </Button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-extrabold tracking-tight">
                  {data.studentName}
                </h1>
                <StatusBadge status={data.status} />
              </div>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {formatMonth(data.month)} · {data.subject} · {data.grade} · {data.instructorName}
              </p>
            </div>
          </div>

          <Button asChild variant="ghost" size="sm">
            <Link href={`/admin/students/${data.studentId}`}>
              <Users aria-hidden />
              Student history
            </Link>
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => handleDownload("pdf")}>
            <FileText aria-hidden />
            Download PDF
          </Button>
          <Button variant="secondary" onClick={() => handleDownload("word")}>
            <Download aria-hidden />
            Download Word
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer aria-hidden />
            Print
          </Button>
          {canReview ? (
            <Button onClick={handleMarkReviewed} loading={busy}>
              <CheckCircle2 aria-hidden />
              Mark as reviewed
            </Button>
          ) : null}
          {canReview ? (
            <Button variant="outline" onClick={() => setRevisionOpen(true)}>
              <RotateCcw aria-hidden />
              Request revision
            </Button>
          ) : null}
        </div>

        {data.status === "needs_revision" && data.reviewerNote ? (
          <p className="rounded-card border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
            Revision requested: {data.reviewerNote}
          </p>
        ) : null}

        <p className="rounded-card border border-border bg-background px-4 py-2.5 text-xs text-muted-foreground">
          PDF and Word downloads are stubbed until the document service is connected — use
          Print → Save as PDF in the meantime. This exact layout is what the backend will render.
        </p>
      </div>

      {/* Document preview */}
      <ReportDocument report={data} />

      {/* Revision dialog */}
      <Dialog open={revisionOpen} onOpenChange={setRevisionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a revision</DialogTitle>
            <DialogDescription>
              {data.instructorName} will see your note the next time they open this report for{" "}
              {formatMonth(data.month)}.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-2">
            <Label htmlFor="revision-note">What needs to change?</Label>
            <Textarea
              id="revision-note"
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                setNoteError("");
              }}
              placeholder="e.g. Please add examples from class activities and confirm the topics list."
              aria-invalid={Boolean(noteError)}
            />
            {noteError ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {noteError}
              </p>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRevisionOpen(false)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={handleRequestRevision}>
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}