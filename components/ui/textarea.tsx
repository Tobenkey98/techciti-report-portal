import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Shows a live "12 / 600" counter under the field. */
  maxLengthHint?: number;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, maxLengthHint, onChange, value, ...props }, ref) => {
    const [length, setLength] = React.useState(
      typeof value === "string" ? value.length : (props.defaultValue as string)?.length ?? 0,
    );

    return (
      <div className="w-full">
        <textarea
          ref={ref}
          value={value}
          onChange={(event) => {
            setLength(event.target.value.length);
            onChange?.(event);
          }}
          className={cn(
            "w-full resize-y rounded-button border border-border bg-surface px-3.5 py-3 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/30",
            maxLengthHint ? "min-h-[104px]" : "min-h-[112px]",
            className,
          )}
          {...props}
        />
        {maxLengthHint ? (
          <p
            className={cn(
              "mt-1.5 text-right text-xs tabular",
              length > maxLengthHint * 0.9 ? "text-warning" : "text-muted-foreground",
            )}
          >
            {length} / {maxLengthHint}
          </p>
        ) : null}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };