"use client";

import * as React from "react";
import { MessageCircle } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn, whatsappLink } from "@/lib/utils";

/**
 * Opens WhatsApp with a pre-filled message.
 *
 * wa.me works as a plain link, so this stays an <a> — right-click → open in a
 * new tab works, and it degrades gracefully on desktop (WhatsApp Web).
 */
export function WhatsAppButton({
  phone,
  message,
  children,
  className,
  variant = "secondary",
  size = "sm",
  onClick,
  ...props
}: {
  phone: string;
  message: string;
  children?: React.ReactNode;
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  onClick?: () => void;
}) {
  const href = whatsappLink(phone, message);

  return (
    <Button asChild variant={variant} size={size} className={className} {...props}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        title={`Open WhatsApp chat with a pre-filled message`}
      >
        <MessageCircle aria-hidden />
        {children ?? "WhatsApp"}
      </a>
    </Button>
  );
}

/** Small square icon-only variant for table rows. */
export function WhatsAppIconButton({
  phone,
  message,
  label,
  className,
}: {
  phone: string;
  message: string;
  label: string;
  className?: string;
}) {
  return (
    <a
      href={whatsappLink(phone, message)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-success-soft hover:text-success focus-visible:ring-2 focus-visible:ring-primary",
        className,
      )}
    >
      <MessageCircle className="size-[18px]" aria-hidden />
    </a>
  );
}