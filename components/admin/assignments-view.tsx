"use client";

import * as React from "react";
import { Link2, Plus, Trash2, Users } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field } from "@/components/shared/field";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SkeletonTable } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAsyncData } from "@/hooks/use-async-data";
import { useToast } from "@/hooks/use-toast";
import {
  assignments as assignmentsApi,
  instructors as instructorsApi,
  students as studentsApi,
} from "@/lib/api";
import { SUBJECTS } from "@/lib/constants";
import type { Assignment, Instructor, Student } from "@/lib/types";
import { cn, pluralise } from "@/lib/utils";

export function AssignmentsView() {
  const toast = useToast();
  const [search, setSearch] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});
  const [form, setForm] = React.useState({ instructorId: "", studentId: "", subject: "" });
  const [removing, setRemoving] = React.useState<Assignment | null>(null);

  const instructors = useAsyncData<Instructor[]>(() => instructorsApi.list({ status: "active" }), []);
  const students = useAsyncData<Student[]>(() => studentsApi.list({ status: "active" }), []);
  const list = useAsyncData<Assignment[]>(() => assignmentsApi.list(), []);

  const assignmentRows = React.useMemo(() => {
    const tutorMap = new Map((instructors.data ?? []).map((tutor) => [tutor.id, tutor]));
    const studentMap = new Map((students.data ?? []).map((student) => [student.id, student]));
    const rows = (list.data ?? []).map((assignment) => ({
      assignment,
      tutor: tutorMap.get(assignment.instructorId),
      student: studentMap.get(assignment.studentId),
    }));

    const term = search.trim().toLowerCase();
    return term
      ? rows.filter((row) =>
          [row.tutor?.fullName, row.student?.fullName, row.student?.grade, row.assignment.subject]
            .join(" ")
            .toLowerCase()
            .includes(term),
        )
      : rows;
  }, [list.data, instructors.data, students.data, search]);

  const selectedTutor = (instructors.data ?? []).find((tutor) => tutor.id === form.instructorId);
  const suggestedSubjects =
    selectedTutor?.subjects ?? (Array.from(SUBJECTS) as string[]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormErrors({});

    try {
      await assignmentsApi.create(form);
      toast.success({
        title: "Tutor assigned",
        description: "They will see this student in their portal right away.",
      });
      setForm({ instructorId: "", studentId: "", subject: "" });
      await list.refresh();
    } catch (error) {
      const fieldErrors =
        error && typeof error === "object" && "fieldErrors" in error
          ? ((error as { fieldErrors?: Record<string, string> }).fieldErrors ?? {})
          : {};
      setFormErrors(
        Object.keys(fieldErrors).length
          ? fieldErrors
          : { form: error instanceof Error ? error.message : "Could not create assignment." },
      );
      toast.error({ title: "Could not assign", description: error instanceof Error ? error.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!removing) return;
    setSaving(true);
    try {
      await assignmentsApi.remove(removing.id);
      toast.success({ title: "Assignment removed", description: "Reports already submitted are kept." });
      await list.refresh();
    } finally {
      setSaving(false);
      setRemoving(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignments"
        description="Link tutors to students. A student can have several subjects, and subjects can be taught by different tutors."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        {/* Create form */}
        <Card className="h-fit">
          <div className="border-b border-border p-5">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Link2 className="size-4 text-primary" aria-hidden />
              New assignment
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              One line = one monthly report the tutor must submit.
            </p>
          </div>

          <form onSubmit={handleCreate} className="space-y-4 p-5" noValidate>
            {formErrors.form ? (
              <p role="alert" className="rounded-button bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                {formErrors.form}
              </p>
            ) : null}

            <Field id="assign-tutor" label="Tutor" required error={formErrors.instructorId}>
              <Select
                value={form.instructorId}
                onValueChange={(value) => {
                  setForm((current) => ({ ...current, instructorId: value, subject: "" }));
                  setFormErrors((current) => ({ ...current, instructorId: "", form: "" }));
                }}
              >
                <SelectTrigger id="assign-tutor">
                  <SelectValue placeholder="Select tutor" />
                </SelectTrigger>
                <SelectContent>
                  {(instructors.data ?? []).map((tutor) => (
                    <SelectItem key={tutor.id} value={tutor.id}>
                      {tutor.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field id="assign-student" label="Student" required error={formErrors.studentId}>
              <Select
                value={form.studentId}
                onValueChange={(value) => {
                  setForm((current) => ({ ...current, studentId: value }));
                  setFormErrors((current) => ({ ...current, studentId: "", form: "" }));
                }}
              >
                <SelectTrigger id="assign-student">
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {(students.data ?? []).map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.fullName} · {student.grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              id="assign-subject"
              label="Subject"
              required
              hint={selectedTutor ? "Taught by this tutor" : "Any subject"}
              error={formErrors.subject}
            >
              <Select
                value={form.subject}
                onValueChange={(value) => {
                  setForm((current) => ({ ...current, subject: value }));
                  setFormErrors((current) => ({ ...current, subject: "", form: "" }));
                }}
              >
                <SelectTrigger id="assign-subject">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {suggestedSubjects.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Button type="submit" className="w-full" loading={saving}>
              <Plus aria-hidden />
              Assign tutor
            </Button>
          </form>
        </Card>

        {/* Table */}
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search tutor, student or subject…"
              className="sm:max-w-sm"
              aria-label="Search assignments"
            />
            <p className="text-sm text-muted-foreground sm:ml-auto">
              {list.loading ? "Loading…" : pluralise(assignmentRows.length, "assignment")}
            </p>
          </div>

          {list.loading && !list.data ? (
            <SkeletonTable rows={6} columns={4} />
          ) : assignmentRows.length === 0 ? (
            <EmptyState
              icon={<Users className="size-6" aria-hidden />}
              title={search ? "No assignments match" : "No assignments yet"}
              description={
                search
                  ? "Try a different name or subject."
                  : "Use the form to link a tutor to a student. That creates one monthly report."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Student</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Tutor</TableHead>
                  <TableHead className="pr-5 text-right">Remove</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignmentRows.map(({ assignment, tutor, student }) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="pl-5">
                      {student ? (
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">
                            {student.fullName}
                          </p>
                          <p className="text-sm text-muted-foreground">{student.grade}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Deleted student</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="primary">{assignment.subject}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={cn("text-sm", !tutor && "text-muted-foreground")}>
                        {tutor?.fullName ?? "Deactivated tutor"}
                      </span>
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove assignment for ${student?.fullName ?? "student"}`}
                        onClick={() => setRemoving(assignment)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title="Remove this assignment?"
        description="The tutor will stop seeing this student. Reports already submitted are kept."
        confirmLabel="Remove assignment"
        destructive
        loading={saving}
        onConfirm={handleRemove}
      />
    </div>
  );
}