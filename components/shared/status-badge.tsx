import { STATUS_META } from "@/lib/constants";
import type { ProgressRating, ReportStatus, TutorCardStatus } from "@/lib/types";
import { RATING_META } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Compact status pill used in tables and cards. */
export function StatusBadge({
  status,
  className,
  showDot = true,
}: {
  status: ReportStatus | TutorCardStatus;
  className?: string;
  showDot?: boolean;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        meta.badge,
        className,
      )}
    >
      {showDot ? <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden /> : null}
      {meta.label}
    </span>
  );
}

/** Rating pill (Excellent → Needs attention). */
export function RatingBadge({
  rating,
  className,
}: {
  rating: ProgressRating | null;
  className?: string;
}) {
  if (!rating) {
    return (
      <span className={cn("text-sm text-muted-foreground", className)}>
        Not rated
      </span>
    );
  }

  const variant = RATING_META[rating].variant;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        variant === "success" && "bg-success-soft text-success",
        variant === "warning" && "bg-warning-soft text-warning",
        variant === "destructive" && "bg-danger-soft text-danger",
        variant === "default" && "bg-primary-soft text-primary",
        className,
      )}
      title={RATING_META[rating].description}
    >
      {rating}
    </span>
  );
}

/** Big green/neutral/red count used on the dashboard stat cards. */
export function CountPill({
  value,
  tone,
}: {
  value: string | number;
  tone: "neutral" | "success" | "warning" | "danger" | "primary";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-sm font-bold tabular",
        tone === "neutral" && "bg-background text-muted-foreground",
        tone === "success" && "bg-success-soft text-success",
        tone === "warning" && "bg-warning-soft text-warning",
        tone === "danger" && "bg-danger-soft text-danger",
        tone === "primary" && "bg-primary-soft text-primary",
      )}
    >
      {value}
    </span>
  );
}