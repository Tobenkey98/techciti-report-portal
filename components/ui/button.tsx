"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-button font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-55 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /* White text on --primary is reserved for bold 15–16px labels (AA large-text). */
        primary:
          "bg-primary text-[15px] font-bold text-primary-foreground shadow-sm hover:bg-primary-hover active:bg-primary-hover",
        secondary:
          "bg-surface text-[15px] text-foreground ring-1 ring-inset ring-border hover:bg-primary-soft hover:text-primary",
        outline:
          "bg-transparent text-[15px] text-foreground ring-1 ring-inset ring-border hover:bg-primary-soft hover:text-primary",
        soft: "bg-primary-soft text-[15px] text-primary hover:bg-primary hover:text-primary-foreground",
        ghost: "bg-transparent text-[15px] text-muted-foreground hover:bg-primary-soft hover:text-primary",
        danger: "bg-danger text-[15px] font-bold text-primary-foreground shadow-sm hover:bg-danger/90",
        link: "bg-transparent text-[15px] font-semibold text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-3.5 text-sm [&_svg]:size-4",
        default: "h-11 px-5 [&_svg]:size-[18px]",
        lg: "h-12 px-6 text-base [&_svg]:size-5",
        icon: "size-11 [&_svg]:size-[18px]",
        "icon-sm": "size-9 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            <span className="sr-only">Working…</span>
            {asChild ? null : children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };