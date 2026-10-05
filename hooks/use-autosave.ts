"use client";

import * as React from "react";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

export interface AutosaveOptions {
  /** Milliseconds of quiet before the draft is saved. */
  delay?: number;
  enabled?: boolean;
  onSave: (value: unknown) => Promise<unknown>;
  onSaved?: (value: unknown) => void;
  onError?: (error: Error) => void;
}

export interface AutosaveResult<T> {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
  saveNow: () => Promise<void>;
}

/**
 * Debounced autosave used by the tutor report form.
 *
 * Every keystroke schedules a save `delay` ms later; typing never blocks the
 * UI and the form can report a quiet "Saved" indicator to the tutor.
 */
export function useAutosave<T>(value: T, options: AutosaveOptions): AutosaveResult<T> {
  const { delay = 2500, enabled = true, onSave, onSaved, onError } = options;
  const [status, setStatus] = React.useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = React.useState<Date | null>(null);

  const latest = React.useRef(value);
  latest.current = value;

  const handlers = React.useRef({ onSave, onSaved, onError });
  handlers.current = { onSave, onSaved, onError };

  const dirty = React.useRef(false);
  const timer = React.useRef<number | null>(null);
  const saving = React.useRef(false);

  const flush = React.useCallback(async () => {
    if (!dirty.current || saving.current) return;
    saving.current = true;
    setStatus("saving");
    try {
      await handlers.current.onSave(latest.current);
      dirty.current = false;
      setStatus("saved");
      setLastSavedAt(new Date());
      handlers.current.onSaved?.(latest.current);
    } catch (error) {
      setStatus("error");
      handlers.current.onError?.(error instanceof Error ? error : new Error("Autosave failed"));
    } finally {
      saving.current = false;
    }
  }, []);

  React.useEffect(() => {
    if (!enabled) return;
    if (!dirty.current) return;

    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), delay);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [value, delay, enabled, flush]);

  /** Marks the current value as needing a save on the next debounce tick. */
  const markDirty = React.useCallback(() => {
    dirty.current = true;
    if (status === "idle" || status === "saved") setStatus("idle");
  }, [status]);

  // Track edits generically: any change of `value` counts as dirty.
  const previous = React.useRef(value);
  React.useEffect(() => {
    if (previous.current !== value) {
      previous.current = value;
      markDirty();
    }
  }, [value, markDirty]);

  const saveNow = React.useCallback(async () => {
    if (timer.current) window.clearTimeout(timer.current);
    await flush();
  }, [flush]);

  return { status, lastSavedAt, saveNow };
}