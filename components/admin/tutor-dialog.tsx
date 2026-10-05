"use client";

import * as React from "react";
import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { instructors as instructorsApi } from "@/lib/api";
import { SUBJECTS } from "@/lib/constants";
import type { Instructor, InstructorFormValues } from "@/lib/types";
import { cn } from "@/lib/utils";

const EMPTY: InstructorFormValues = {
  fullName: "",
  email: "",
  phone: "",
  subjects: [],
};

export function TutorDialog({
  open,
  onOpenChange,
  tutor,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` opens the "add tutor" form. */
  tutor: Instructor | null;
  onSaved: (tutor: Instructor, mode: "created" | "updated") => void;
}) {
  const [values, setValues] = React.useState<InstructorFormValues>(EMPTY);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setErrors({});
    setValues(
      tutor
        ? {
            fullName: tutor.fullName,
            email: tutor.email,
            phone: tutor.phone,
            subjects: tutor.subjects,
          }
        : EMPTY,
    );
  }, [open, tutor]);

  const toggleSubject = (subject: string) => {
    setValues((current) => ({
      ...current,
      subjects: current.subjects.includes(subject)
        ? current.subjects.filter((item) => item !== subject)
        : [...current.subjects, subject],
    }));
    setErrors((current) => ({ ...current, subjects: "" }));
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors({});

    try {
      const saved = tutor
        ? await instructorsApi.update(tutor.id, values)
        : await instructorsApi.create(values);
      onSaved(saved, tutor ? "updated" : "created");
      onOpenChange(false);
    } catch (error) {
      const fieldErrors =
        error && typeof error === "object" && "fieldErrors" in error
          ? ((error as { fieldErrors?: Record<string, string> }).fieldErrors ?? {})
          : {};
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) {
        setErrors({ form: error instanceof Error ? error.message : "Could not save tutor." });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{tutor ? "Edit tutor" : "Add a tutor"}</DialogTitle>
          <DialogDescription>
            {tutor
              ? "Update this tutor's details. Their private link stays the same."
              : "We will generate a private portal link for them — no password needed."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate>
          <DialogBody className="space-y-5">
            {errors.form ? (
              <p role="alert" className="rounded-button bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                {errors.form}
              </p>
            ) : null}

            <Field id="tutor-name" label="Full name" required error={errors.fullName}>
              <Input
                id="tutor-name"
                value={values.fullName}
                autoComplete="name"
                placeholder="e.g. Amaka Obi"
                onChange={(event) => setValues((c) => ({ ...c, fullName: event.target.value }))}
                aria-invalid={Boolean(errors.fullName)}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="tutor-email" label="Email address" required error={errors.email}>
                <Input
                  id="tutor-email"
                  type="email"
                  value={values.email}
                  autoComplete="email"
                  placeholder="name@techciti.ng"
                  onChange={(event) => setValues((c) => ({ ...c, email: event.target.value }))}
                  aria-invalid={Boolean(errors.email)}
                />
              </Field>

              <Field
                id="tutor-phone"
                label="WhatsApp number"
                required
                hint="Reminders go here"
                error={errors.phone}
              >
                <Input
                  id="tutor-phone"
                  type="tel"
                  inputMode="tel"
                  value={values.phone}
                  autoComplete="tel"
                  prefix="+234"
                  placeholder="801 234 5678"
                  onChange={(event) => setValues((c) => ({ ...c, phone: event.target.value }))}
                  aria-invalid={Boolean(errors.phone)}
                />
              </Field>
            </div>

            <Field
              id="tutor-subjects"
              label="Subjects taught"
              required
              hint="Select all that apply"
              error={errors.subjects}
            >
              <div
                id="tutor-subjects"
                role="group"
                aria-label="Subjects taught"
                className="flex flex-wrap gap-2"
              >
                {SUBJECTS.map((subject) => {
                  const active = values.subjects.includes(subject);
                  return (
                    <button
                      key={subject}
                      type="button"
                      role="checkbox"
                      aria-checked={active}
                      onClick={() => toggleSubject(subject)}
                      className={cn(
                        "inline-flex min-h-9 items-center rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors",
                        "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-surface text-muted-foreground hover:border-primary hover:bg-primary-soft hover:text-primary",
                      )}
                    >
                      {subject}
                    </button>
                  );
                })}
              </div>
            </Field>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {tutor ? "Save changes" : "Create tutor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}