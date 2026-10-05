import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * TechCiti mark.
 *
 * Swap `logo.svg` in /public for the real asset once available — the SVG below
 * keeps the header crisp and needs no network request. Colours come from the
 * brand tokens (`currentColor` + `var(--primary)`), never raw hex.
 */
export function TechCitiMark({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 40 40"
      role="img"
      aria-label="TechCiti"
      className={cn("size-9", className)}
      {...props}
    >
      <defs>
        <linearGradient id="techciti-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--primary-hover)" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#techciti-mark)" />
      <path
        d="M13 13.5 19.5 20 13 26.5"
        fill="none"
        stroke="var(--primary-foreground)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22.5 27H28"
        fill="none"
        stroke="var(--primary-foreground)"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({
  className,
  showSub = false,
  invert = false,
  markClassName,
}: {
  className?: string;
  /** Small descriptor under the wordmark, e.g. "Tutor Report Portal". */
  showSub?: boolean;
  /** Use on orange backgrounds. */
  invert?: boolean;
  markClassName?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <TechCitiMark className={markClassName ?? "size-9"} />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "text-[17px] font-extrabold tracking-tight",
            invert ? "text-primary-foreground" : "text-foreground",
          )}
        >
          Tech<span className={invert ? "text-primary-foreground" : "text-primary"}>Citi</span>
        </span>
        {showSub ? (
          <span
            className={cn(
              "mt-1 text-[10px] font-bold uppercase tracking-[0.14em]",
              invert ? "text-primary-foreground/85" : "text-muted-foreground",
            )}
          >
            Tutor Report Portal
          </span>
        ) : null}
      </span>
    </span>
  );
}