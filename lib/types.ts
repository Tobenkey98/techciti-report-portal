/* ------------------------------------------------------------------ *
 * Domain types for the TechCiti Tutor Report Portal.
 * These are the shapes the backend will need to return — the UI never
 * knows whether the data came from mocks or a real API.
 * ------------------------------------------------------------------ */

/** Academic month key, formatted `YYYY-MM` (e.g. "2026-10"). */
export type MonthKey = string;

export type EntityStatus = "active" | "inactive";

export type ProgressRating = "Excellent" | "Good" | "Fair" | "Needs attention";

export const PROGRESS_RATINGS: ProgressRating[] = [
  "Excellent",
  "Good",
  "Fair",
  "Needs attention",
];

/** Lifecycle of a monthly report. `draft` never leaves the tutor's device view until submitted. */
export type ReportStatus = "draft" | "submitted" | "reviewed" | "needs_revision";

export const REPORT_STATUSES: ReportStatus[] = [
  "draft",
  "submitted",
  "reviewed",
  "needs_revision",
];

/** What the tutor sees on a student card. Derived, never stored. */
export type TutorCardStatus = "not_started" | "draft" | "submitted";

export interface Instructor {
  id: string;
  fullName: string;
  email: string;
  /** WhatsApp number in international format, digits only (e.g. 2348012345678). */
  phone: string;
  /** Secret segment of the tutor's private portal link: /t/[token] */
  token: string;
  subjects: string[];
  status: EntityStatus;
  createdAt: string;
}

export interface Student {
  id: string;
  fullName: string;
  grade: string;
  gender: "Male" | "Female";
  parentName: string;
  /** WhatsApp number for the parent, digits only. */
  parentPhone: string;
  status: EntityStatus;
  createdAt: string;
}

export interface Assignment {
  id: string;
  instructorId: string;
  studentId: string;
  subject: string;
  createdAt: string;
}

/** The tutor-submitted monthly report for one (student, subject, month) triple. */
export interface Report {
  id: string;
  assignmentId: string;
  instructorId: string;
  studentId: string;
  subject: string;
  month: MonthKey;

  /** Topics covered this month. */
  topicsCovered: string;
  /** Does learning need to continue next month? */
  continuityNeeded: boolean;
  /** Required when continuityNeeded === true. */
  continuityNote: string;
  /** General feedback shown to the parent. */
  generalFeedback: string;
  /** Private comment from the tutor to the TechCiti admin. */
  tutorComment: string;
  progressRating: ProgressRating | null;

  status: ReportStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  /** Admin note attached to a revision request. */
  reviewerNote: string | null;

  createdAt: string;
  updatedAt: string;
}

/** Draft payload used by the report form. Kept separate from Report so the
 *  read-only context fields (tutor, student, grade, subject, month) can never
 *  be tampered with from the client. */
export type ReportDraftInput = Pick<
  Report,
  | "topicsCovered"
  | "continuityNeeded"
  | "continuityNote"
  | "generalFeedback"
  | "tutorComment"
  | "progressRating"
>;

/* ----------------------------- View models ----------------------------- */

/** A report row enriched with its student + tutor, ready for tables. */
export interface ReportWithContext extends Report {
  instructorName: string;
  studentName: string;
  grade: string;
}

/** One student card inside the instructor portal. */
export interface PortalStudentCard {
  assignmentId: string;
  studentId: string;
  studentName: string;
  grade: string;
  subject: string;
  status: TutorCardStatus;
  reportId: string | null;
  report: Report | null;
}

export interface PortalSummary {
  total: number;
  submitted: number;
  inProgress: number;
  notStarted: number;
}

export interface InstructorPortalData {
  instructor: Instructor;
  month: MonthKey;
  students: PortalStudentCard[];
  summary: PortalSummary;
}

export interface DashboardStats {
  totalInstructors: number;
  activeInstructors: number;
  totalStudents: number;
  activeStudents: number;
  /** Reports submitted/reviewed for the selected month. */
  submitted: number;
  /** Reports still outstanding (not started or draft). */
  pending: number;
  /** Total reports expected for the month = active assignments. */
  expected: number;
}

/** An instructor who still owes reports for the selected month. */
export interface OutstandingTutor {
  instructor: Instructor;
  total: number;
  submitted: number;
  outstanding: number;
  students: string[];
}

export interface DashboardData {
  month: MonthKey;
  stats: DashboardStats;
  outstanding: OutstandingTutor[];
  recent: ReportWithContext[];
}

export interface StudentProfile {
  student: Student;
  reports: ReportWithContext[];
  subjects: string[];
  averageRating: number | null;
}

export interface AdminSession {
  email: string;
  name: string;
  role: "admin";
  token: string;
  issuedAt: string;
}

/* --------------------------- Query / command types --------------------------- */

export interface ReportQuery {
  month?: MonthKey | "all";
  instructorId?: string | "all";
  studentId?: string | "all";
  grade?: string | "all";
  subject?: string | "all";
  status?: ReportStatus | "all";
  search?: string;
  sort?: ReportSortKey;
  direction?: SortDirection;
  page?: number;
  pageSize?: number;
}

export type ReportSortKey =
  | "studentName"
  | "instructorName"
  | "subject"
  | "month"
  | "status"
  | "progressRating"
  | "submittedAt"
  | "updatedAt";

export type SortDirection = "asc" | "desc";

export interface PaginatedResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/* ------------------------------ Bulk import ------------------------------ */

export type ImportKind = "instructors" | "students";

export interface ImportRow {
  /** 1-based row number in the uploaded file (header excluded). */
  rowNumber: number;
  raw: Record<string, string>;
  values: Partial<Instructor> | Partial<Student>;
  errors: string[];
}

export interface ImportPreview {
  kind: ImportKind;
  rows: ImportRow[];
  validCount: number;
  errorCount: number;
  duplicateCount: number;
}

export interface ImportResult {
  created: number;
  skipped: number;
  failed: number;
}

/* --------------------------------- Toasts --------------------------------- */

export type ToastVariant = "default" | "success" | "destructive" | "warning";

export interface ToastPayload {
  title: string;
  description?: string;
  variant?: ToastVariant;
}

/* --------------------------------- Forms --------------------------------- */

export interface InstructorFormValues {
  fullName: string;
  email: string;
  phone: string;
  subjects: string[];
}

export interface StudentFormValues {
  fullName: string;
  grade: string;
  gender: Student["gender"];
  parentName: string;
  parentPhone: string;
}

export interface AssignmentFormValues {
  instructorId: string;
  studentId: string;
  subject: string;
}

/* --------------------------------- Errors --------------------------------- */

export type ApiErrorCode =
  | "NOT_FOUND"
  | "VALIDATION"
  | "DUPLICATE_REPORT"
  | "UNAUTHORIZED"
  | "CONFLICT";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly fieldErrors?: Record<string, string | undefined>;

  constructor(
    code: ApiErrorCode,
    message: string,
    fieldErrors?: Record<string, string | undefined>,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}