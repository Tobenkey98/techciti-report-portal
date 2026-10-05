"use client";

import * as React from "react";

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: "default" | "success" | "destructive" | "warning";
  /** ms — defaults to 4000, errors linger a little longer. */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

type Listener = (toasts: ToastItem[]) => void;

let counter = 0;
let items: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener(items));
}

function remove(id: number) {
  items = items.filter((item) => item.id !== id);
  emit();
}

/** Imperative toast API: `const toast = useToast(); toast.success({...})`. */
export function useToast() {
  const [toasts, setToasts] = React.useState<ToastItem[]>(items);

  React.useEffect(() => {
    listeners.add(setToasts);
    return () => {
      listeners.delete(setToasts);
    };
  }, []);

  const push = React.useCallback((options: ToastOptions) => {
    counter += 1;
    const id = counter;
    items = [...items, { ...options, id }].slice(-4);
    emit();
    const duration = options.duration ?? (options.variant === "destructive" ? 6000 : 4000);
    if (duration > 0) window.setTimeout(() => remove(id), duration);
    return id;
  }, []);

  const dismiss = React.useCallback((id: number) => remove(id), []);

  return React.useMemo(
    () => ({
      toasts,
      dismiss,
      toast: push,
      success: (options: Omit<ToastOptions, "variant">) =>
        push({ ...options, variant: "success" }),
      error: (options: Omit<ToastOptions, "variant">) =>
        push({ ...options, variant: "destructive" }),
      warning: (options: Omit<ToastOptions, "variant">) =>
        push({ ...options, variant: "warning" }),
    }),
    [toasts, dismiss, push],
  );
}