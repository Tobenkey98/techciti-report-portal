import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  size?: "sm" | "md";
}

/** Friendly, non-alarming zero state used across tables and lists. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  size = "md",
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        size === "md" ? "px-6 py-14" : "px-4 py-8",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span
          className={cn(
            "flex items-center justify-center rounded-2xl bg-primary-soft text-primary",
            size === "md" ? "size-14" : "size-11",
          )}
          aria-hidden
        >
          {icon}
        </span>
      ) : null}
      <div className="max-w-sm space-y-1">
        <h3 className={cn("font-bold text-foreground", size === "md" ? "text-base" : "text-sm")}>
          {title}
        </h3>
        {description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}