"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";

/** Copy-to-clipboard button with a friendly confirmation state. */
export function CopyButton({
  value,
  label = "Copy link",
  copiedLabel = "Copied",
  className,
  variant = "secondary",
  size = "sm",
  onCopied,
  ...props
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  disabled?: boolean;
  onCopied?: () => void;
}) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(className)}
      onClick={async () => {
        const ok = await copy(value);
        if (ok) onCopied?.();
      }}
      {...props}
    >
      {copied ? (
        <Check className="text-success" aria-hidden />
      ) : (
        <Copy aria-hidden />
      )}
      {copied ? copiedLabel : label}
    </Button>
  );
}