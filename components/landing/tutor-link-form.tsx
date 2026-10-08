"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Picks a token out of a full URL, a /t/<token> path, or a bare token. */
function extractToken(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const fromPath = trimmed.match(/\/t\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/);
  if (fromPath) return fromPath[1];
  if (/^[A-Za-z0-9_-]{6,}$/.test(trimmed)) return trimmed;
  return "";
}

export function TutorLinkForm() {
  const router = useRouter();
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const token = extractToken(value);
    if (!token) {
      setError("Paste your full private link or token — it ends with /t/ followed by a code.");
      return;
    }
    setError("");
    router.push(`/t/${token}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-8 rounded-card border border-border/70 bg-surface p-5 shadow-card ring-1 ring-black/[0.02] sm:p-6"
    >
      <Label htmlFor="tutor-link" className="text-sm font-bold">
        Open your report portal
      </Label>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Paste the private link your admin sent you on WhatsApp, then press Continue.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Link2
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="tutor-link"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste your link, e.g. …/t/abc123…"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError("");
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "tutor-link-error" : undefined}
            className="pl-10 font-mono text-sm"
          />
        </div>
        <Button type="submit" size="lg" className="shrink-0">
          Continue
          <ArrowRight aria-hidden />
        </Button>
      </div>
      {error ? (
        <p id="tutor-link-error" role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          No account, no password — the link itself is your access. Lost it? Ask your
          admin to resend it.
        </p>
      )}
    </form>
  );
}
