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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { students as studentsApi } from "@/lib/api";
import { GENDERS, gradeGroups } from "@/lib/constants";
import type { Student, StudentFormValues } from "@/lib/types";

const EMPTY: StudentFormValues = {
  fullName: "",
  grade: "",
  gender: "Male",
  parentName: "",
  parentPhone: "",
};

export function StudentDialog({
  open,
  onOpenChange,
  student,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
  onSaved: (student: Student, mode: "created" | "updated") => void;
}) {
  const [values, setValues] = React.useState<StudentFormValues>(EMPTY);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setErrors({});
    setValues(
      student
        ? {
            fullName: student.fullName,
            grade: student.grade,
            gender: student.gender,
            parentName: student.parentName,
            parentPhone: student.parentPhone,
          }
        : EMPTY,
    );
  }, [open, student]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors({});

    try {
      const saved = student
        ? await studentsApi.update(student.id, values)
        : await studentsApi.create(values);
      onSaved(saved, student ? "updated" : "created");
      onOpenChange(false);
    } catch (error) {
      const fieldErrors =
        error && typeof error === "object" && "fieldErrors" in error
          ? ((error as { fieldErrors?: Record<string, string> }).fieldErrors ?? {})
          : {};
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) {
        setErrors({ form: error instanceof Error ? error.message : "Could not save student." });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{student ? "Edit student" : "Add a student"}</DialogTitle>
          <DialogDescription>
            {student
              ? "Update this student's details."
              : "Once added, assign them to a tutor on the Assignments page."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate>
          <DialogBody className="space-y-5">
            {errors.form ? (
              <p role="alert" className="rounded-button bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                {errors.form}
              </p>
            ) : null}

            <Field id="student-name" label="Full name" required error={errors.fullName}>
              <Input
                id="student-name"
                value={values.fullName}
                autoComplete="off"
                placeholder="e.g. Chidera Nwosu"
                onChange={(event) => setValues((c) => ({ ...c, fullName: event.target.value }))}
                aria-invalid={Boolean(errors.fullName)}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="student-grade" label="Grade" required error={errors.grade}>
                <Select
                  value={values.grade}
                  onValueChange={(grade) => setValues((c) => ({ ...c, grade }))}
                >
                  <SelectTrigger id="student-grade" aria-invalid={Boolean(errors.grade)}>
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {gradeGroups().map((group) => (
                      <SelectGroup key={group.label}>
                        <SelectLabel>{group.label}</SelectLabel>
                        {group.grades.map((grade) => (
                          <SelectItem key={grade} value={grade}>
                            {grade}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field id="student-gender" label="Gender">
                <Select
                  value={values.gender}
                  onValueChange={(value) =>
                    setValues((c) => ({ ...c, gender: value as Student["gender"] }))
                  }
                >
                  <SelectTrigger id="student-gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDERS.map((gender) => (
                      <SelectItem key={gender} value={gender}>
                        {gender}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="rounded-card border border-border bg-background p-4">
              <p className="text-sm font-bold text-foreground">Parent / guardian</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Used to send report-ready notifications.
              </p>

              <div className="mt-4 space-y-5">
                <Field id="parent-name" label="Parent name">
                  <Input
                    id="parent-name"
                    value={values.parentName}
                    autoComplete="off"
                    placeholder="e.g. Mrs Ngozi Nwosu"
                    onChange={(event) =>
                      setValues((c) => ({ ...c, parentName: event.target.value }))
                    }
                  />
                </Field>

                <Field id="parent-phone" label="Parent WhatsApp" error={errors.parentPhone}>
                  <Input
                    id="parent-phone"
                    type="tel"
                    inputMode="tel"
                    value={values.parentPhone}
                    autoComplete="off"
                    prefix="+234"
                    placeholder="801 234 5678"
                    onChange={(event) =>
                      setValues((c) => ({ ...c, parentPhone: event.target.value }))
                    }
                    aria-invalid={Boolean(errors.parentPhone)}
                  />
                </Field>
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {student ? "Save changes" : "Create student"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}