import * as React from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-button border border-border bg-surface text-[15px] text-foreground placeholder:text-muted-foreground/70 transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-background disabled:opacity-70 aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/30";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  /** Rendered inside a fixed cell before the control, e.g. a "+234" dialling code. */
  prefix?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, prefix, ...props }, ref) => {
    const control = (
      <input
        type={type}
        ref={ref}
        className={cn(
          fieldBase,
          "h-11 px-3.5",
          prefix && "rounded-l-none border-l-0",
          className,
        )}
        {...props}
      />
    );

    if (!prefix) return control;

    return (
      <div className="flex">
        <span className="inline-flex h-11 items-center rounded-l-button border border-r-0 border-border bg-background px-3 text-sm font-medium text-muted-foreground">
          {prefix}
        </span>
        {control}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
