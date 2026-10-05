"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { RATING_META } from "@/lib/constants";
import { PROGRESS_RATINGS, type ProgressRating } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Large, thumb-friendly progress rating chips.
 * Built as a radio group so arrow keys and screen readers work out of the box.
 */
export function RatingChips({
  value,
  onChange,
  disabled,
  columns = 2,
  idPrefix = "rating",
}: {
  value: ProgressRating | null;
  onChange: (rating: ProgressRating) => void;
  disabled?: boolean;
  columns?: 1 | 2 | 4;
  idPrefix?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Progress rating"
      className={cn(
        "grid gap-2",
        columns === 1 && "grid-cols-1",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
      )}
    >
      {PROGRESS_RATINGS.map((rating) => {
        const selected = value === rating;
        const tone = RATING_META[rating].variant;
        const inputId = `${idPrefix}-${rating.toLowerCase().replace(/\s+/g, "-")}`;

        return (
          <label
            key={rating}
            htmlFor={inputId}
            className={cn(
              "relative flex cursor-pointer items-center gap-3 rounded-button border-2 bg-surface px-4 py-3.5 transition-all",
              "hover:border-primary/40 hover:bg-primary-soft/50",
              "focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2",
              selected && "border-primary bg-primary-soft shadow-sm",
              disabled && "cursor-not-allowed opacity-60 hover:border-border hover:bg-surface",
            )}
          >
            <input
              id={inputId}
              type="radio"
              name={idPrefix}
              value={rating}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(rating)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background",
                tone === "success" && selected && "border-success bg-success",
                tone === "warning" && selected && "border-warning bg-warning",
                tone === "destructive" && selected && "border-danger bg-danger",
              )}
              aria-hidden
            >
              {selected ? <Check className="size-4" strokeWidth={3} /> : null}
            </span>
            <span className="min-w-0">
              <span className={cn("block text-[15px] font-bold", selected && "text-primary")}>
                {rating}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                {RATING_META[rating].description}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}