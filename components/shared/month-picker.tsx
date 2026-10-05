"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatMonth, getCurrentMonth, monthOptions } from "@/lib/utils";

interface MonthPickerProps {
  value: string;
  onChange: (month: string) => void;
  /** How many months back to offer (default 12). */
  months?: number;
  /** Allow selecting "All months" (admin tables). */
  allowAll?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
}

export function MonthPicker({
  value,
  onChange,
  months = 12,
  allowAll = false,
  className,
  id,
  "aria-label": ariaLabel = "Select month",
}: MonthPickerProps) {
  const options = React.useMemo(() => monthOptions(months, getCurrentMonth()), [months]);
  const currentMonth = getCurrentMonth();

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn("min-w-[168px]", className)}>
        <span className="flex items-center gap-2">
          <CalendarDays className="size-4 text-primary" aria-hidden />
          <SelectValue placeholder="Choose month" />
        </span>
      </SelectTrigger>
      <SelectContent>
        {allowAll ? (
          <SelectItem value="all">All months</SelectItem>
        ) : null}
        {options.map((month) => (
          <SelectItem key={month} value={month}>
            <span className="flex items-center gap-2">
              {formatMonth(month)}
              {month === currentMonth ? (
                <span className="rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                  Now
                </span>
              ) : null}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}