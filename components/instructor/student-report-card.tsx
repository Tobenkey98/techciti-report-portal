"use client";

import * as React from "react";
import { CheckCircle2, ChevronRight, FileText, RotateCcw } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import type { PortalStudentCard } from "@/lib/types";
import { cn, initials, initialsAvatarColor } from "@/lib/utils";

/**
 * One student on the tutor's list. The whole card is the tap target —
 * phones are the primary device here, so it stays big and obvious.
 */
export function StudentReportCard({
  card,
  onOpen,
  disabled = false,
}: {
  card: PortalStudentCard;
  onOpen: (card: PortalStudentCard) => void;
  disabled?: boolean;
}) {
  const done = card.status === "submitted";

  return (
    <button
      type="button"
      onClick={() => onOpen(card)}
      disabled={disabled}
      aria-label={`${card.studentName}, ${card.subject}, ${card.grade}. ${done ? "Report submitted" : "Open report form"}`}
      className={cn(
        "group flex w-full items-center gap-3.5 rounded-card border bg-surface p-4 text-left shadow-card transition-all sm:p-5",
        "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover",
        "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-60",
        done ? "border-success/25" : "border-border",
      )}
    >
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-full text-sm font-bold",
          initialsAvatarColor(card.studentId),
        )}
        aria-hidden
      >
        {initials(card.studentName)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-[15px] font-bold text-foreground">
            {card.studentName}
          </span>
          <StatusBadge status={card.status} />
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
          <span className="rounded-md bg-background px-1.5 py-0.5 font-semibold text-foreground">
            {card.grade}
          </span>
          <span aria-hidden>·</span>
          <span className="truncate">{card.subject}</span>
          {card.status === "draft" && card.report ? (
            <span className="text-xs text-warning">Draft started</span>
          ) : null}
          {card.report?.status === "needs_revision" ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-danger">
              <RotateCcw className="size-3" aria-hidden />
              Update requested
            </span>
          ) : null}
          {done ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
              <CheckCircle2 className="size-3" aria-hidden />
              Done
            </span>
          ) : null}
        </span>
      </span>

      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        {done ? <FileText className="size-[18px]" aria-hidden /> : <ChevronRight className="size-5" aria-hidden />}
        <span className="sr-only">Open</span>
      </span>
    </button>
  );
}