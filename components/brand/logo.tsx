import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The TechCiti mark, loaded from `/logo.jpeg` (source: `Techciti_Log.jpeg`).
 *
 * The image sits on a rounded surface rather than being dropped straight onto
 * the page. JPEG has no alpha channel, so an opaque logo placed directly on the
 * orange hero would read as a hard rectangular patch; on a surface it looks
 * deliberate in both the light headers and the inverted hero. The wordmark stays
 * live text so it keeps following the brand tokens and remains selectable,
 * translatable and accessible.
 */
export function TechCitiMark({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  // Kept for any caller that still expects an inline SVG element.
  return (
    <svg viewBox="0 0 40 40" role="presentation" aria-hidden className={cn("size-9", className)} {...props}>
      <rect width="40" height="40" rx="11" fill="var(--primary)" />
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
      <span
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden rounded-[0.7rem] bg-white shadow-sm ring-1 ring-black/5",
          markClassName ?? "size-9",
        )}
      >
        <Image
          src="/logo.jpeg"
          alt=""
          width={533}
          height={530}
          priority
          className="size-full object-cover"
        />
      </span>
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