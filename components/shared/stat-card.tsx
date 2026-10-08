import * as React from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  hint?: string;
  /** Coloured accent strip/icon tile. */
  tone?: "primary" | "success" | "warning" | "danger" | "neutral";
  className?: string;
}

export function StatCard({
  label,
  value,
  icon,
  hint,
  tone = "primary",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-card border border-border/70 bg-surface p-5 shadow-card ring-1 ring-black/[0.02] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover hover:ring-primary/20",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute -right-6 -top-8 size-24 rounded-full opacity-[0.07] transition-opacity group-hover:opacity-[0.13]"
        style={{
          backgroundColor:
            tone === "success"
              ? "rgb(var(--success-rgb))"
              : tone === "warning"
                ? "rgb(var(--warning-rgb))"
                : tone === "danger"
                  ? "rgb(var(--danger-rgb))"
                  : "rgb(var(--primary-rgb))",
        }}
      />
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 h-1",
          tone === "primary" && "bg-primary",
          tone === "success" && "bg-success",
          tone === "warning" && "bg-warning",
          tone === "danger" && "bg-danger",
          tone === "neutral" && "bg-border",
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-3xl font-extrabold tabular leading-none text-foreground">
            {value}
          </p>
          {hint ? <p className="mt-2 text-xs leading-snug text-muted-foreground">{hint}</p> : null}
        </div>
        <span
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-105",
            tone === "primary" && "bg-primary-soft text-primary",
            tone === "success" && "bg-success-soft text-success",
            tone === "warning" && "bg-warning-soft text-warning",
            tone === "danger" && "bg-danger-soft text-danger",
            tone === "neutral" && "bg-background text-muted-foreground",
          )}
          aria-hidden
        >
          {icon}
        </span>
      </div>
    </div>
  );
}