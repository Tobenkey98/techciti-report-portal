"use client";

import * as React from "react";
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CloudUpload,
  CopyPlus,
  Loader2,
  Lock,
  RotateCcw,
  Send,
} from "lucide-react";
import { RatingChips } from "@/components/shared/rating-chips";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAutosave } from "@/hooks/use-autosave";
import { portal, validateDraft, type DraftFieldErrors } from "@/lib/api";
import { topicSuggestionsFor } from "@/lib/constants";
import type { Instructor, PortalStudentCard, ProgressRating, ReportDraftInput } from "@/lib/types";
import { cn, formatDateTime, formatMonth } from "@/lib/utils";

interface ReportDrawerProps {
  card: PortalStudentCard | null;
  instructor: Instructor;
  month: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => void;
}

const EMPTY: ReportDraftInput = {
  topicsCovered: "",
  continuityNeeded: false,
  continuityNote: "",
  generalFeedback: "",
  tutorComment: "",
  progressRating: null,
};

export function ReportDrawer({
  card,
  instructor,
  month,
  open,
  onOpenChange,
  onSubmitted,
}: ReportDrawerProps) {
  const toast = useToast();
  const [values, setValues] = React.useState<ReportDraftInput>(EMPTY);
  const [errors, setErrors] = React.useState<DraftFieldErrors>({});
  const [phase, setPhase] = React.useState<"form" | "success">("form");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [copying, setCopying] = React.useState(false);
  const bodyRef = React.useRef<HTMLDivElement>(null);

  const existing = card?.report ?? null;
  /** Once submitted, the report is read-only until an admin asks for a revision. */
  const locked = Boolean(
    existing && (existing.status === "submitted" || existing.status === "reviewed"),
  );
  const needsRevision = existing?.status === "needs_revision";

  // Seed the form whenever a different student opens (the parent remounts this
  // component with `key`, so this only runs on open).
  React.useEffect(() => {
    if (!card) return;
    setValues(
      existing
        ? {
            topicsCovered: existing.topicsCovered,
            continuityNeeded: existing.continuityNeeded,
            continuityNote: existing.continuityNote,
            generalFeedback: existing.generalFeedback,
            tutorComment: existing.tutorComment,
            progressRating: existing.progressRating,
          }
        : EMPTY,
    );
    setErrors({});
    setPhase("form");
    setConfirmOpen(false);
  }, [card, existing]);

  const assignmentId = card?.assignmentId;
  const draft = values;

  const { status: saveStatus, lastSavedAt, saveNow } = useAutosave(draft, {
    delay: 2500,
    enabled: Boolean(assignmentId) && open && !locked && phase === "form",
    onSave: (payload) => portal.saveDraft(assignmentId!, month, payload as ReportDraftInput),
    onError: () =>
      toast.error({
        title: "Draft not saved",
        description: "We could not save your draft. Check your connection and try again.",
      }),
  });

  if (!card) return null;

  const update = <K extends keyof ReportDraftInput>(key: K, value: ReportDraftInput[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key as keyof DraftFieldErrors]) {
      setErrors((current) => ({ ...current, [key]: undefined }));
    }
  };

  const suggestions = topicSuggestionsFor(card.subject);
  const activeTopics = topicLines(values.topicsCovered).map((line) => line.toLowerCase());

  async function handleCopyLastMonth() {
    if (!assignmentId) return;
    setCopying(true);
    try {
      const copied = await portal.copyFromPreviousMonth(assignmentId, month);
      setValues({
        topicsCovered: copied.topicsCovered,
        continuityNeeded: copied.continuityNeeded,
        continuityNote: copied.continuityNote,
        generalFeedback: copied.generalFeedback,
        tutorComment: copied.tutorComment,
        progressRating: copied.progressRating,
      });
      toast.success({
        title: "Copied from last month",
        description: "Review the details, update them for this month, then submit.",
      });
    } catch (error) {
      toast.error({
        title: "Could not copy last month",
        description:
          error instanceof Error ? error.message : "There is no previous report to copy yet.",
      });
    } finally {
      setCopying(false);
    }
  }

  async function handleSaveDraft() {
    await saveNow();
    toast.success({ title: "Draft saved", description: "You can safely close this page." });
  }

  function handleRequestSubmit() {
    const found = validateDraft(values);
    setErrors(found);

    if (Object.keys(found).length > 0) {
      const firstKey = Object.keys(found)[0];
      const node = bodyRef.current?.querySelector<HTMLElement>(`[data-field="${firstKey}"]`);
      node?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.warning({
        title: "Almost there",
        description: "A few answers still need your attention before you can submit.",
      });
      return;
    }

    setConfirmOpen(true);
  }

  async function handleSubmit() {
    if (!assignmentId) return;
    setSubmitting(true);
    try {
      await portal.submit(assignmentId, month, values);
      setConfirmOpen(false);
      setPhase("success");
      onSubmitted();
      toast.success({
        title: "Report submitted",
        description: `${card.studentName} · ${formatMonth(month)}. Thank you!`,
      });
    } catch (error) {
      setConfirmOpen(false);
      const message = error instanceof Error ? error.message : "Something went wrong.";
      const fieldErrors =
        error && typeof error === "object" && "fieldErrors" in error
          ? ((error as { fieldErrors?: Record<string, string> }).fieldErrors ?? {})
          : {};
      if (Object.keys(fieldErrors).length > 0) {
        // Show exactly which answers need attention, and jump to the first one.
        setErrors((current) => ({ ...current, ...fieldErrors }));
        const firstKey = Object.keys(fieldErrors)[0];
        const node = bodyRef.current?.querySelector<HTMLElement>(`[data-field="${firstKey}"]`);
        node?.scrollIntoView({ behavior: "smooth", block: "center" });
        toast.warning({
          title: "Some fields need attention",
          description: "Review the highlighted answers, then submit again.",
        });
      } else if (message.toLowerCase().includes("already been submitted")) {
        toast.error({ title: "Already submitted", description: message });
        onSubmitted();
      } else {
        toast.error({ title: "Could not submit", description: message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-[600px]" aria-describedby="report-drawer-desc">
          <SheetHeader>
            <div className="flex items-center gap-2">
              <StatusBadge status={existing?.status ?? "not_started"} />
              <Badge variant="outline">{formatMonth(month)}</Badge>
            </div>
            <SheetTitle className="mt-2 pr-8 text-xl">{card.studentName}</SheetTitle>
            <SheetDescription id="report-drawer-desc">
              {phase === "success"
                ? "Report received by the TechCiti team."
                : locked
                  ? "This report has been submitted and is now locked."
                  : `Monthly ${card.subject} report for ${card.studentName}.`}
            </SheetDescription>
          </SheetHeader>

          <SheetBody ref={bodyRef} className="space-y-7 pb-2">
            {phase === "success" ? (
              <SuccessPanel
                studentName={card.studentName}
                subject={card.subject}
                month={month}
                submittedAt={new Date().toISOString()}
                onDone={() => onOpenChange(false)}
              />
            ) : (
              <>
                {needsRevision && existing?.reviewerNote ? (
                  <div className="flex gap-3 rounded-card border border-danger/30 bg-danger-soft p-4">
                    <RotateCcw className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
                    <div>
                      <p className="text-sm font-bold text-danger">Update requested by admin</p>
                      <p className="mt-1 text-sm leading-relaxed text-foreground">
                        {existing.reviewerNote}
                      </p>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Please make the changes above and submit again.
                      </p>
                    </div>
                  </div>
                ) : null}

                {locked ? (
                  <div className="flex gap-3 rounded-card border border-success/30 bg-success-soft p-4">
                    <Lock className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
                    <div>
                      <p className="text-sm font-bold text-success">Submitted</p>
                      <p className="mt-1 text-sm leading-relaxed text-foreground">
                        Sent {formatDateTime(existing?.submittedAt ?? null)}.
                        {existing?.status === "reviewed"
                          ? " The TechCiti team has reviewed it."
                          : " It is with the TechCiti team for review."}
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* Auto-filled, read-only context */}
                <section aria-labelledby="context-heading" className="space-y-3">
                  <SectionHeading id="context-heading" title="Report details" />
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-card border border-border bg-background/70 p-4 text-sm">
                    <ReadOnlyField label="Tutor" value={instructor.fullName} />
                    <ReadOnlyField label="Student" value={card.studentName} />
                    <ReadOnlyField label="Grade" value={card.grade} />
                    <ReadOnlyField label="Subject" value={card.subject} />
                    <ReadOnlyField label="Month" value={formatMonth(month)} />
                    <ReadOnlyField label="Report ID" value={existing?.id ?? "New report"} mono />
                  </dl>
                </section>

                {/* Topics covered */}
                <section data-field="topicsCovered" className="space-y-3">
                  <FieldLabel
                    htmlFor="topics"
                    label="Topics covered this month"
                    required
                    error={errors.topicsCovered}
                    errorId="topics-error"
                  />
                  <Textarea
                    id="topics"
                    value={values.topicsCovered}
                    onChange={(event) => update("topicsCovered", event.target.value)}
                    aria-invalid={Boolean(errors.topicsCovered)}
                    aria-describedby={errors.topicsCovered ? "topics-error" : undefined}
                    placeholder={"1. Place value\n2. Fractions\n3. Word problems"}
                    className="min-h-[128px]"
                    maxLengthHint={600}
                  />
                  {suggestions.length ? (
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Quick add
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {suggestions.map((topic) => {
                          const active = activeTopics.includes(topic.toLowerCase());
                          return (
                            <button
                              key={topic}
                              type="button"
                              aria-pressed={active}
                              onClick={() => update("topicsCovered", toggleTopic(values.topicsCovered, topic))}
                              className={cn(
                                "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors",
                                "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                                active
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-surface text-muted-foreground hover:border-primary hover:bg-primary-soft hover:text-primary",
                              )}
                            >
                              {active ? <CheckCircle2 className="size-3.5" aria-hidden /> : null}
                              {topic}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </section>

                {/* Continuity */}
                <section data-field="continuityNote" className="space-y-3">
                  <div className="flex items-center justify-between gap-4 rounded-card border border-border bg-surface p-4">
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold text-foreground">
                        Does learning need to continue next month?
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        We use this to plan the next month&apos;s lessons.
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5">
                      <span
                        className={cn(
                          "text-sm font-bold",
                          values.continuityNeeded ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {values.continuityNeeded ? "Yes" : "No"}
                      </span>
                      <Switch
                        id="continuity"
                        checked={values.continuityNeeded}
                        onCheckedChange={(checked) => update("continuityNeeded", checked)}
                        aria-label="Does learning need to continue next month"
                      />
                    </div>
                  </div>

                  {values.continuityNeeded ? (
                    <div className="space-y-2 animate-fade-in">
                      <FieldLabel
                        htmlFor="continuity-note"
                        label="What should continue next month"
                        required
                        error={errors.continuityNote}
                        errorId="continuity-note-error"
                      />
                      <Textarea
                        id="continuity-note"
                        value={values.continuityNote}
                        onChange={(event) => update("continuityNote", event.target.value)}
                        aria-invalid={Boolean(errors.continuityNote)}
                        aria-describedby={
                          errors.continuityNote ? "continuity-note-error" : undefined
                        }
                        placeholder="Repeat the introduction to fractions with more practical examples…"
                        maxLengthHint={400}
                      />
                    </div>
                  ) : null}
                </section>

                {/* General feedback */}
                <section data-field="generalFeedback" className="space-y-3">
                  <FieldLabel
                    htmlFor="feedback"
                    label="General feedback for this student"
                    required
                    hint="Shared with parents"
                    error={errors.generalFeedback}
                    errorId="feedback-error"
                  />
                  <Textarea
                    id="feedback"
                    value={values.generalFeedback}
                    onChange={(event) => update("generalFeedback", event.target.value)}
                    aria-invalid={Boolean(errors.generalFeedback)}
                    placeholder="A short paragraph on how the student is progressing this month."
                    maxLengthHint={600}
                  />
                </section>

                {/* Tutor comment */}
                <section data-field="tutorComment" className="space-y-3">
                  <FieldLabel
                    htmlFor="tutor-comment"
                    label="Tutor's comment"
                    hint="Only TechCiti admins see this"
                  />
                  <Textarea
                    id="tutor-comment"
                    value={values.tutorComment}
                    onChange={(event) => update("tutorComment", event.target.value)}
                    placeholder="Anything the admin should know — attendance, parent contact, concerns…"
                    className="min-h-[96px]"
                    maxLengthHint={400}
                  />
                </section>

                {/* Rating */}
                <section data-field="progressRating" className="space-y-3">
                  <FieldLabel
                    label="Progress this month"
                    required
                    error={errors.progressRating}
                    errorId="rating-error"
                  />
                  <div aria-describedby={errors.progressRating ? "rating-error" : undefined}>
                    <RatingChips
                      idPrefix={`rating-${card.assignmentId}`}
                      value={values.progressRating}
                      onChange={(rating: ProgressRating) => update("progressRating", rating)}
                      disabled={locked}
                    />
                  </div>
                </section>
              </>
            )}
          </SheetBody>

          {phase === "form" ? (
            <SheetFooter>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <SaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} hidden={locked} />
                  {!locked ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyLastMonth}
                      loading={copying}
                    >
                      <CopyPlus aria-hidden />
                      Copy from last month
                    </Button>
                  ) : null}
                </div>

                {!locked ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="sm:flex-1"
                      onClick={handleSaveDraft}
                    >
                      Save draft
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      className="sm:flex-1"
                      onClick={handleRequestSubmit}
                    >
                      <Send aria-hidden />
                      Submit report
                    </Button>
                  </div>
                ) : (
                  <Button type="button" size="lg" onClick={() => onOpenChange(false)}>
                    Back to my students
                  </Button>
                )}
              </div>
            </SheetFooter>
          ) : null}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Submit this report?"
        description={
          <>
            This sends the {formatMonth(month)} report for{" "}
            <strong className="text-foreground">
              {card.studentName} ({card.subject})
            </strong>{" "}
            to the TechCiti team. Once submitted you cannot edit it — ask the admin if
            something needs to change.
          </>
        }
        confirmLabel="Yes, submit"
        cancelLabel="Keep editing"
        loading={submitting}
        onConfirm={handleSubmit}
      />
    </>
  );
}

/* ------------------------------- Sub-parts ------------------------------- */

function SectionHeading({ id, title }: { id: string; title: string }) {
  return (
    <h3 id={id} className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
      {title}
    </h3>
  );
}

function ReadOnlyField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 truncate font-semibold text-foreground",
          mono && "font-mono text-xs font-normal",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function FieldLabel({
  htmlFor,
  label,
  required,
  hint,
  error,
  errorId,
}: {
  htmlFor?: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  errorId?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <label htmlFor={htmlFor} className="text-[15px] font-bold text-foreground">
        {label}
        {required ? (
          <span className="ml-1 text-primary" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      {error ? (
        <span
          id={errorId}
          role="alert"
          className="flex items-center gap-1 text-sm font-medium text-danger"
        >
          <AlertCircle className="size-3.5" aria-hidden />
          {error}
        </span>
      ) : null}
    </div>
  );
}

function SaveIndicator({
  status,
  lastSavedAt,
  hidden,
}: {
  status: ReturnType<typeof useAutosave>["status"];
  lastSavedAt: Date | null;
  hidden?: boolean;
}) {
  if (hidden) return null;

  const config = {
    idle: { text: "Draft autosaves as you type", className: "text-muted-foreground" },
    saving: { text: "Saving…", className: "text-muted-foreground" },
    saved: {
      text: `Saved${
        lastSavedAt
          ? ` at ${lastSavedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
          : ""
      }`,
      className: "text-success",
    },
    error: { text: "Autosave failed", className: "text-danger" },
  }[status];

  return (
    <p
      aria-live="polite"
      className={cn("flex items-center gap-1.5 text-xs font-semibold", config.className)}
    >
      {status === "saving" ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : status === "saved" ? (
        <CloudUpload className="size-3.5" aria-hidden />
      ) : status === "error" ? (
        <AlertCircle className="size-3.5" aria-hidden />
      ) : (
        <CalendarClock className="size-3.5" aria-hidden />
      )}
      {config.text}
    </p>
  );
}

function SuccessPanel({
  studentName,
  subject,
  month,
  submittedAt,
  onDone,
}: {
  studentName: string;
  subject: string;
  month: string;
  submittedAt: string;
  onDone: () => void;
}) {
  return (
    <div className="space-y-6 py-4 text-center">
      <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
        <CheckCircle2 className="size-9" aria-hidden />
      </span>

      <div className="space-y-2">
        <h3 className="text-xl font-extrabold tracking-tight">Report submitted</h3>
        <p className="mx-auto max-w-sm text-[15px] leading-relaxed text-muted-foreground">
          {studentName}&apos;s {subject} report for {formatMonth(month)} is with the TechCiti
          team. You will be notified if anything needs a change.
        </p>
      </div>

      <dl className="mx-auto grid max-w-sm grid-cols-2 gap-3 rounded-card border border-border bg-background/70 p-4 text-left text-sm">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Student
          </dt>
          <dd className="mt-0.5 font-semibold">{studentName}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Month
          </dt>
          <dd className="mt-0.5 font-semibold">{formatMonth(month)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Sent
          </dt>
          <dd className="mt-0.5 font-semibold">{formatDateTime(submittedAt)}</dd>
        </div>
      </dl>

      <Button type="button" size="lg" onClick={onDone} className="w-full sm:w-auto">
        <ArrowLeft aria-hidden />
        Back to my students
      </Button>
    </div>
  );
}

/* -------------------------------- Helpers -------------------------------- */

function topicLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Toggles a suggestion chip in/out of the numbered topics list. */
function toggleTopic(value: string, topic: string): string {
  const cleaned = topicLines(value).map((line) => line.replace(/^\d+[.)]\s*/, "").trim());
  const exists = cleaned.some((line) => line.toLowerCase() === topic.toLowerCase());
  const next = exists
    ? cleaned.filter((line) => line.toLowerCase() !== topic.toLowerCase())
    : [...cleaned, topic];
  return next.map((line, index) => `${index + 1}. ${line}`).join("\n");
}