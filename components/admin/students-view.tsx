"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  MoreHorizontal,
  Pencil,
  Plus,
  SlidersHorizontal,
  Users,
  UserX,
} from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { StudentDialog } from "@/components/admin/student-dialog";
import { useAsyncData } from "@/hooks/use-async-data";
import { useToast } from "@/hooks/use-toast";
import { students as studentsApi } from "@/lib/api";
import { gradeGroups, SUBJECTS } from "@/lib/constants";
import type { Student } from "@/lib/types";
import { initials, initialsAvatarColor, prettyPhone } from "@/lib/utils";

export function StudentsView() {
  const toast = useToast();
  const [search, setSearch] = React.useState("");
  const [grade, setGrade] = React.useState("all");
  const [subject, setSubject] = React.useState("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Student | null>(null);
  const [confirm, setConfirm] = React.useState<Student | null>(null);
  const [busy, setBusy] = React.useState(false);

  const { data, loading, refresh } = useAsyncData<Student[]>(
    () => studentsApi.list({ search, grade, subject }),
    [search, grade, subject],
  );

  const list = data ?? [];
  const filtersActive = search !== "" || grade !== "all" || subject !== "all";

  async function toggleStatus(student: Student) {
    const next = student.status === "active" ? "inactive" : "active";
    try {
      await studentsApi.setStatus(student.id, next);
      toast.success({
        title: next === "active" ? "Student reactivated" : "Student deactivated",
        description:
          next === "active"
            ? `${student.fullName} is active again.`
            : `${student.fullName} will stop appearing in new assignments.`,
      });
      await refresh();
    } catch (error) {
      toast.error({
        title: "Could not update student",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="Every learner on the programme, with their grade and parent contact."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus aria-hidden />
            Add student
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by student or parent name…"
            className="lg:max-w-xs"
            aria-label="Search students"
          />

          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden items-center gap-1.5 text-sm font-semibold text-muted-foreground sm:flex">
              <SlidersHorizontal className="size-4" aria-hidden />
              Filter
            </span>

            <Select value={grade} onValueChange={setGrade}>
              <SelectTrigger className="w-full sm:w-[150px]" aria-label="Filter by grade">
                <SelectValue placeholder="All grades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All grades</SelectItem>
                {gradeGroups().map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.grades.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>

            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger className="w-full sm:w-[190px]" aria-label="Filter by subject">
                <SelectValue placeholder="All subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {SUBJECTS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {filtersActive ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setGrade("all");
                  setSubject("all");
                }}
              >
                Clear
              </Button>
            ) : null}
          </div>

          <p className="text-sm text-muted-foreground lg:ml-auto">
            {loading ? "Loading…" : `${list.length} student${list.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {loading && !data ? (
          <SkeletonTable rows={6} columns={6} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6" aria-hidden />}
            title={filtersActive ? "No students match these filters" : "No students yet"}
            description={
              filtersActive
                ? "Try clearing the search or choosing a different grade and subject."
                : "Add students manually or import a spreadsheet from the Bulk import page."
            }
            action={
              filtersActive ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setGrade("all");
                    setSubject("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setEditing(null);
                    setDialogOpen(true);
                  }}
                >
                  <Plus aria-hidden />
                  Add student
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Student</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Parent / guardian</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((student) => {
                const inactive = student.status === "inactive";
                return (
                  <TableRow key={student.id} className={inactive ? "opacity-60" : undefined}>
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${initialsAvatarColor(student.id)}`}
                          aria-hidden
                        >
                          {initials(student.fullName)}
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/admin/students/${student.id}`}
                            className="truncate font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline"
                          >
                            {student.fullName}
                          </Link>
                          <p className="font-mono text-xs text-muted-foreground">
                            {student.id}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline">{student.grade}</Badge>
                    </TableCell>

                    <TableCell className="text-sm text-muted-foreground">{student.gender}</TableCell>

                    <TableCell>
                      {student.parentName ? (
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {student.parentName}
                          </p>
                          <p className="truncate text-xs tabular text-muted-foreground">
                            {prettyPhone(student.parentPhone)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell>
                      {inactive ? (
                        <Badge variant="danger">Deactivated</Badge>
                      ) : (
                        <Badge variant="success">
                          <CheckCircle2 className="size-3" aria-hidden />
                          Active
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="pr-5">
                      <div className="flex justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Actions for ${student.fullName}`}
                            >
                              <MoreHorizontal aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/students/${student.id}`}>
                                <Users aria-hidden />
                                View report history
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                setEditing(student);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil aria-hidden />
                              Edit details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              destructive={!inactive}
                              onSelect={() => {
                                setBusy(true);
                                setConfirm(student);
                              }}
                            >
                              {inactive ? (
                                <>
                                  <CheckCircle2 aria-hidden />
                                  Reactivate student
                                </>
                              ) : (
                                <>
                                  <UserX aria-hidden />
                                  Deactivate student
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <StudentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        student={editing}
        onSaved={(saved, mode) => {
          toast.success({
            title: mode === "created" ? "Student added" : "Student updated",
            description:
              mode === "created"
                ? `${saved.fullName} is ready to be assigned to a tutor.`
                : `${saved.fullName}'s details are up to date.`,
          });
          void refresh();
        }}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={
          confirm?.status === "active"
            ? `Deactivate ${confirm.fullName}?`
            : `Reactivate ${confirm?.fullName}?`
        }
        description={
          confirm?.status === "active"
            ? "Existing reports stay intact, but this student will no longer appear in new assignments."
            : "This student will become available for assignment again."
        }
        confirmLabel={confirm?.status === "active" ? "Deactivate" : "Reactivate"}
        destructive={confirm?.status === "active"}
        loading={busy}
        onConfirm={() => confirm && toggleStatus(confirm)}
      />
    </div>
  );
}