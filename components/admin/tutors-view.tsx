"use client";

import * as React from "react";
import {
  CheckCircle2,
  GraduationCap,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  UserX,
} from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CopyButton } from "@/components/shared/copy-button";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { WhatsAppIconButton } from "@/components/shared/whatsapp-button";
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
import { TutorDialog } from "@/components/admin/tutor-dialog";
import { useAsyncData } from "@/hooks/use-async-data";
import { useToast } from "@/hooks/use-toast";
import { instructors as instructorsApi } from "@/lib/api";
import { messages } from "@/lib/messages";
import type { Instructor } from "@/lib/types";
import { initials, initialsAvatarColor, prettyPhone } from "@/lib/utils";

export function TutorsView() {
  const toast = useToast();
  const [search, setSearch] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Instructor | null>(null);
  const [confirm, setConfirm] = React.useState<Instructor | null>(null);
  const [busy, setBusy] = React.useState(false);

  const { data, loading, refresh } = useAsyncData<Instructor[]>(
    () => instructorsApi.list({ search }),
    [search],
  );

  const tutors = data ?? [];

  async function toggleStatus(tutor: Instructor) {
    const next = tutor.status === "active" ? "inactive" : "active";
    try {
      await instructorsApi.setStatus(tutor.id, next);
      toast.success({
        title: next === "active" ? "Tutor reactivated" : "Tutor deactivated",
        description:
          next === "active"
            ? `${tutor.fullName} can submit reports again.`
            : `${tutor.fullName}'s portal link no longer accepts submissions.`,
      });
      await refresh();
    } catch (error) {
      toast.error({
        title: "Could not update tutor",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function handleLinkCopied() {
    toast.success({ title: "Link copied", description: "Paste it into WhatsApp or a message." });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tutors"
        description="Everyone who submits monthly reports. Each tutor gets a private link — no password required."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus aria-hidden />
            Add tutor
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name, email or subject…"
            className="sm:max-w-sm"
            aria-label="Search tutors"
          />
          <p className="text-sm text-muted-foreground sm:ml-auto">
            {loading ? "Loading…" : `${tutors.length} tutor${tutors.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {loading && !data ? (
          <SkeletonTable rows={5} columns={6} />
        ) : tutors.length === 0 ? (
          <EmptyState
            icon={<GraduationCap className="size-6" aria-hidden />}
            title={search ? "No tutors match your search" : "No tutors yet"}
            description={
              search
                ? "Try a different name, email address or subject."
                : "Add your first tutor to start assigning students and collecting reports."
            }
            action={
              search ? (
                <Button variant="outline" onClick={() => setSearch("")}>
                  Clear search
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setEditing(null);
                    setDialogOpen(true);
                  }}
                >
                  <Plus aria-hidden />
                  Add tutor
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Tutor</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Subjects</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tutors.map((tutor) => {
                const link = `/t/${tutor.token}`;
                const inactive = tutor.status === "inactive";

                return (
                  <TableRow key={tutor.id} className={inactive ? "opacity-60" : undefined}>
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${initialsAvatarColor(tutor.id)}`}
                          aria-hidden
                        >
                          {initials(tutor.fullName)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">
                            {tutor.fullName}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">{tutor.email}</p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="whitespace-nowrap text-sm tabular text-muted-foreground">
                        {prettyPhone(tutor.phone)}
                      </span>
                    </TableCell>

                    <TableCell>
                      <div className="flex max-w-[240px] flex-wrap gap-1.5">
                        {tutor.subjects.map((subject) => (
                          <Badge key={subject} variant="primary" size="sm">
                            {subject}
                          </Badge>
                        ))}
                      </div>
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
                      <div className="flex items-center justify-end gap-1.5">
                        <CopyButton
                          value={link}
                          label="Copy link"
                          onCopied={handleLinkCopied}
                          className="hidden sm:inline-flex"
                        />
                        <WhatsAppIconButton
                          phone={tutor.phone}
                          label={`Send portal link to ${tutor.fullName} on WhatsApp`}
                          message={messages.tutorLinkInvite({
                            tutorName: tutor.fullName,
                            link,
                          })}
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${tutor.fullName}`}>
                              <MoreHorizontal aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => {
                                setEditing(tutor);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil aria-hidden />
                              Edit details
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <CopyButton
                                value={link}
                                label="Copy private link"
                                variant="ghost"
                                size="default"
                                className="w-full justify-start"
                                onCopied={handleLinkCopied}
                              />
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              destructive={!inactive}
                              onSelect={() => {
                                setBusy(true);
                                setConfirm(tutor);
                              }}
                            >
                              {inactive ? (
                                <>
                                  <CheckCircle2 aria-hidden />
                                  Reactivate tutor
                                </>
                              ) : (
                                <>
                                  <UserX aria-hidden />
                                  Deactivate tutor
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

      {/* Mobile shortcut row */}
      <p className="flex items-center gap-2 text-xs text-muted-foreground sm:hidden">
        <Link2 className="size-3.5" aria-hidden />
        Tap the copy icon on a tutor&apos;s card to grab their private link.
      </p>

      <TutorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tutor={editing}
        onSaved={(saved, mode) => {
          toast.success({
            title: mode === "created" ? "Tutor added" : "Tutor updated",
            description:
              mode === "created"
                ? `Send ${saved.fullName} their private link: /t/${saved.token}`
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
        title={confirm?.status === "active" ? `Deactivate ${confirm.fullName}?` : `Reactivate ${confirm?.fullName}?`}
        description={
          confirm?.status === "active"
            ? "Their private link will stop working and they will no longer appear in submission tracking."
            : "Their private link will start working again immediately."
        }
        confirmLabel={confirm?.status === "active" ? "Deactivate" : "Reactivate"}
        destructive={confirm?.status === "active"}
        loading={busy}
        onConfirm={() => confirm && toggleStatus(confirm)}
      />
    </div>
  );
}