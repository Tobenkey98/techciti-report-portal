"use client";

import * as React from "react";
import {
  CheckCircle2,
  LibraryBig,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Trash2,
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
import { SkeletonTable } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CourseDialog } from "@/components/admin/course-dialog";
import { useAsyncData } from "@/hooks/use-async-data";
import { useToast } from "@/hooks/use-toast";
import { courses as coursesApi } from "@/lib/api";
import type { Course } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function CoursesView() {
  const toast = useToast();
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<"all" | "active" | "inactive">("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Course | null>(null);
  const [confirmStatus, setConfirmStatus] = React.useState<Course | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<Course | null>(null);
  const [busy, setBusy] = React.useState(false);

  const { data, loading, refresh } = useAsyncData<Course[]>(
    () => coursesApi.list({ search, status }),
    [search, status],
  );

  const list = data ?? [];

  async function toggleStatus(course: Course) {
    const next = !course.isActive;
    try {
      await coursesApi.setStatus(course.id, next);
      toast.success({
        title: next ? "Course activated" : "Course deactivated",
        description: next
          ? `${course.name} is available for new assignments again.`
          : `${course.name} can no longer be picked for new assignments.`,
      });
      await refresh();
    } catch (error) {
      toast.error({
        title: "Could not update course",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
      setConfirmStatus(null);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await coursesApi.remove(confirmDelete.id);
      toast.success({ title: "Course deleted", description: `${confirmDelete.name} was removed.` });
      await refresh();
    } catch (error) {
      toast.error({
        title: "Could not delete course",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
      setConfirmDelete(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Courses"
        description="The catalogue tutors teach from. Add new courses, rename old ones, or deactivate what you no longer offer."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus aria-hidden />
            Add course
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by course or category…"
            className="sm:max-w-sm"
            aria-label="Search courses"
          />
          <div className="flex items-center gap-2 sm:ml-auto">
            <Button
              variant={status === "all" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatus("all")}
            >
              All
            </Button>
            <Button
              variant={status === "active" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatus("active")}
            >
              Active
            </Button>
            <Button
              variant={status === "inactive" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatus("inactive")}
            >
              Inactive
            </Button>
          </div>
        </div>

        {loading && !data ? (
          <SkeletonTable rows={5} columns={4} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<LibraryBig className="size-6" aria-hidden />}
            title={search || status !== "all" ? "No courses match" : "No courses yet"}
            description={
              search || status !== "all"
                ? "Try a different search or filter."
                : "Add your first course so tutors can be assigned to students."
            }
            action={
              search || status !== "all" ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setStatus("all");
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
                  Add course
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Course</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="pr-5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((course) => {
                const inactive = !course.isActive;
                return (
                  <TableRow key={course.id} className={inactive ? "opacity-60" : undefined}>
                    <TableCell className="pl-5">
                      <p className="truncate font-semibold text-foreground">{course.name}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="primary">{course.category}</Badge>
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
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(course.createdAt)}
                    </TableCell>
                    <TableCell className="pr-5">
                      <div className="flex justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Actions for ${course.name}`}
                            >
                              <MoreHorizontal aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => {
                                setEditing(course);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil aria-hidden />
                              Edit details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                setBusy(true);
                                setConfirmStatus(course);
                              }}
                            >
                              <Power aria-hidden />
                              {inactive ? "Reactivate course" : "Deactivate course"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              destructive
                              onSelect={() => {
                                setBusy(true);
                                setConfirmDelete(course);
                              }}
                            >
                              <Trash2 aria-hidden />
                              Delete course
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

      <CourseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        course={editing}
        onSaved={(saved, mode) => {
          toast.success({
            title: mode === "created" ? "Course added" : "Course updated",
            description:
              mode === "created"
                ? `${saved.name} is now available when assigning tutors.`
                : `${saved.name} is up to date everywhere it is used.`,
          });
          void refresh();
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmStatus)}
        onOpenChange={(open) => {
          if (!open) setConfirmStatus(null);
        }}
        title={confirmStatus?.isActive ? `Deactivate ${confirmStatus.name}?` : `Reactivate ${confirmStatus?.name}?`}
        description={
          confirmStatus?.isActive
            ? "It can no longer be picked for new assignments. Existing assignments keep working."
            : "It becomes available for new assignments again."
        }
        confirmLabel={confirmStatus?.isActive ? "Deactivate" : "Reactivate"}
        destructive={confirmStatus?.isActive}
        loading={busy}
        onConfirm={() => confirmStatus && toggleStatus(confirmStatus)}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
        title={`Delete ${confirmDelete?.name}?`}
        description="This only works while no assignment uses the course. Deactivate it instead if it is in use."
        confirmLabel="Delete"
        destructive
        loading={busy}
        onConfirm={handleDelete}
      />
    </div>
  );
}
