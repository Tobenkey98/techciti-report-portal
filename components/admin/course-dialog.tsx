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
import { courses as coursesApi } from "@/lib/api";
import type { Course, CourseFormValues } from "@/lib/types";

const EMPTY: CourseFormValues = {
  name: "",
  category: "",
};

export function CourseDialog({
  open,
  onOpenChange,
  course,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` opens the "add course" form. */
  course: Course | null;
  onSaved: (course: Course, mode: "created" | "updated") => void;
}) {
  const [values, setValues] = React.useState<CourseFormValues>(EMPTY);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setErrors({});
    setValues(
      course
        ? {
            name: course.name,
            category: course.category,
          }
        : EMPTY,
    );
  }, [open, course]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors({});

    try {
      const saved = course
        ? await coursesApi.update(course.id, values)
        : await coursesApi.create(values);
      onSaved(saved, course ? "updated" : "created");
      onOpenChange(false);
    } catch (error) {
      const fieldErrors =
        error && typeof error === "object" && "fieldErrors" in error
          ? ((error as { fieldErrors?: Record<string, string> }).fieldErrors ?? {})
          : {};
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) {
        setErrors({ form: error instanceof Error ? error.message : "Could not save course." });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{course ? "Edit course" : "Add a course"}</DialogTitle>
          <DialogDescription>
            {course
              ? "Rename this course or change its category. Assignments using it update automatically."
              : "Courses are the catalogue tutors pick from when they are assigned to students."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate>
          <DialogBody className="space-y-5">
            {errors.form ? (
              <p role="alert" className="rounded-button bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                {errors.form}
              </p>
            ) : null}

            <Field id="course-name" label="Course name" required error={errors.name}>
              <Input
                id="course-name"
                value={values.name}
                autoComplete="off"
                placeholder="e.g. Python Programming"
                onChange={(event) => setValues((c) => ({ ...c, name: event.target.value }))}
                aria-invalid={Boolean(errors.name)}
              />
            </Field>

            <Field
              id="course-category"
              label="Category"
              required
              hint="e.g. Coding, Data, Design"
              error={errors.category}
            >
              <Input
                id="course-category"
                value={values.category}
                autoComplete="off"
                placeholder="e.g. Coding"
                onChange={(event) => setValues((c) => ({ ...c, category: event.target.value }))}
                aria-invalid={Boolean(errors.category)}
              />
            </Field>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {course ? "Save changes" : "Create course"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
