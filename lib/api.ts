/* ------------------------------------------------------------------ *
 * TechCiti Tutor Report Portal — API layer
 *
 * The frontend communicates exclusively with the live Express + Prisma
 * backend. No in-memory mock mode remains in this build.
 * ------------------------------------------------------------------ */
import type {
  AdminSession,
  Assignment,
  AssignmentFormValues,
  Course,
  CourseFormValues,
  DashboardData,
  ImportKind,
  ImportPreview,
  ImportResult,
  Instructor,
  InstructorFormValues,
  InstructorPortalData,
  PaginatedResult,
  ProgressRating,
  Report,
  ReportDraftInput,
  ReportQuery,
  ReportSortKey,
  ReportWithContext,
  SortDirection,
  Student,
  StudentFormValues,
  StudentProfile,
  TutorCardStatus,
} from "@/lib/types";

import { normalisePhone } from "@/lib/utils";

export interface ApiErrorDetails {
  [field: string]: string;
}

export type ApiErrorCode =
  | "NOT_FOUND"
  | "VALIDATION"
  | "DUPLICATE_REPORT"
  | "UNAUTHORIZED"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "EXPORT_UNSUPPORTED"
  | "TOKEN_NOT_FOUND";

export class ApiError extends Error {
  code: ApiErrorCode;
  fieldErrors?: ApiErrorDetails;

  constructor(code: ApiErrorCode, message: string, fieldErrors?: ApiErrorDetails) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

type QueryValue = string | number | boolean | undefined | null;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
  base?: string;
  tutorAuth?: boolean;
  json?: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";
const ADMIN_BASE = `${API_BASE}/admin`;
const TUTOR_BASE = `${API_BASE}/tutor`;

export function setTutorToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem("techciti.tutor.token", token);
  else localStorage.removeItem("techciti.tutor.token");
}

interface ErrorEnvelope {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

function mapErrorCode(code: string): ApiError["code"] {
  switch (code) {
    case "NOT_FOUND":
    case "ENTITY_NOT_FOUND":
    case "TOKEN_NOT_FOUND":
      return "NOT_FOUND";
    case "VALIDATION":
    case "BAD_REQUEST":
      return "VALIDATION";
    case "DUPLICATE_REPORT":
    case "ASSIGNMENT_EXISTS":
    case "DUPLICATE":
      return "DUPLICATE_REPORT";
    case "UNAUTHORIZED":
    case "FORBIDDEN":
    case "TOKEN_REVOKED":
      return "UNAUTHORIZED";
    case "CONFLICT":
      return "CONFLICT";
    case "EXPORT_UNSUPPORTED":
      return "EXPORT_UNSUPPORTED";
    default:
      return "NOT_FOUND";
  }
}

function toFieldErrors(details: unknown): Record<string, string> | undefined {
  if (details && typeof details === "object" && "issues" in details) {
    const issues = (details as any).issues as Array<{ path?: (string | number)[]; message?: string }>;
    const out: Record<string, string> = {};
    for (const entry of issues) {
      const field = entry.path?.map((p) => String(p)).join(".");
      if (field && entry.message) out[field] = entry.message;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (Array.isArray(details)) {
    const out: Record<string, string> = {};
    for (const entry of details) {
      if (entry && typeof entry === "object") {
        const field = (entry as any).field as string | undefined;
        const message = (entry as any).message as string | undefined;
        if (field && message) out[field] = message;
      }
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (typeof details === "object") {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
      if (typeof value === "string") out[key] = value;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const base = options.base ?? ADMIN_BASE;
  const url = new URL(`${base}${path}`, typeof window === "undefined" ? "http://localhost:3000" : window.location.origin);
  Object.entries(options.query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  });
  const headers: Record<string, string> = {};
  if (options.json !== false) headers["Content-Type"] = "application/json";
  headers["Accept"] = "application/json";
  if (options.tutorAuth) {
    const token = typeof window === "undefined" ? null : localStorage.getItem("techciti.tutor.token");
    if (token) headers["X-Tutor-Token"] = token;
  }
  const body = options.body ? JSON.stringify(options.body) : undefined;
  const res = await fetch(url.toString(), { method: options.method ?? "GET", headers, body, credentials: "include" });
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiError("INTERNAL_ERROR", `Unexpected response (${res.status}).`);
  }
  const data = (await res.json()) as T | ErrorEnvelope;
  if ((data as ErrorEnvelope).success === false) {
    const err = (data as ErrorEnvelope).error;
    throw new ApiError(mapErrorCode(err.code), err.message, toFieldErrors(err.details));
  }
  const payload = (data as any).data;
  return (payload as T) ?? (data as T);
}

async function download(path: string, filename: string): Promise<void> {
  const url = `${ADMIN_BASE}${path}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new ApiError("EXPORT_UNSUPPORTED", "Could not download the document.");
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(href);
}

/* ------------------------------------------------------------------ */
/*                               Mappers                               */
/* ------------------------------------------------------------------ */

interface BackendAdmin {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface BackendTutor {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  isActive: boolean;
  tokenRevokedAt: string | null;
  createdAt: string;
  accessToken?: string;
}

interface BackendStudent {
  id: string;
  fullName: string;
  ageGroup: string;
  parentName: string | null;
  parentPhone: string | null;
  parentEmail: string | null;
  isActive: boolean;
  createdAt: string;
}

interface BackendCourse {
  id: string;
  name: string;
  category: string;
  isActive: boolean;
  createdAt: string;
}

interface BackendAssignment {
  id: string;
  tutorId: string;
  studentId: string;
  courseId: string;
  level: string;
  isActive: boolean;
  createdAt: string;
  tutor?: { id: string; fullName: string; email: string | null; phone: string };
  student?: { id: string; fullName: string; ageGroup: string; parentName: string | null; parentPhone: string | null; parentEmail?: string | null };
  course?: { id: string; name: string; category: string };
}

interface BackendReport {
  id: string;
  assignmentId: string;
  month: string;
  topicsCovered: string;
  continuityNeeded: boolean;
  continuityNote: string | null;
  generalFeedback: string;
  tutorComment: string;
  progressRating: string | null;
  status: string;
  revisionNote: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tutor?: { id: string; fullName: string };
  student?: { id: string; fullName: string; ageGroup?: string };
  course?: { id: string; name: string };
}

const STATUS_FROM_BACKEND: Record<string, Report["status"]> = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  REVIEWED: "reviewed",
  NEEDS_REVISION: "needs_revision",
};

const RATING_FROM_BACKEND: Record<string, ProgressRating | null> = {
  EXCELLENT: "Excellent",
  GOOD: "Good",
  FAIR: "Fair",
  NEEDS_ATTENTION: "Needs attention",
  "Needs attention": "Needs attention",
};

/** Frontend labels → the backend's enum (submit/autosave reject anything else). */
const RATING_TO_BACKEND: Record<string, string> = {
  Excellent: "EXCELLENT",
  Good: "GOOD",
  Fair: "FAIR",
  "Needs attention": "NEEDS_ATTENTION",
};

function toBackendDraft(draft: ReportDraftInput): Record<string, unknown> {
  return {
    topicsCovered: draft.topicsCovered,
    continuityNeeded: draft.continuityNeeded,
    continuityNote: draft.continuityNote,
    generalFeedback: draft.generalFeedback,
    tutorComment: draft.tutorComment,
    progressRating: draft.progressRating ? (RATING_TO_BACKEND[draft.progressRating] ?? null) : null,
  };
}

function ageGroupFromGrade(grade: string): string {
  if (!grade) return "TEENS";
  if (grade.startsWith("Primary")) return "KIDS";
  if (grade.startsWith("JSS")) return "TEENS";
  if (grade.startsWith("SSS")) return "TEENS";
  return "TEENS";
}

function ageGroupToGrade(ageGroup?: string): string {
  switch ((ageGroup ?? "TEENS").toUpperCase()) {
    case "KIDS":
      return "Primary 5";
    case "TEENS":
      return "JSS 2";
    case "ADULTS":
      return "SSS 2";
    default:
      return "JSS 2";
  }
}

function ratingRank(rating: ProgressRating | null): number {
  if (rating === "Excellent") return 4;
  if (rating === "Good") return 3;
  if (rating === "Fair") return 2;
  if (rating === "Needs attention") return 1;
  return 0;
}

function mapRating(value: string | null | undefined): ProgressRating | null {
  if (!value) return null;
  return RATING_FROM_BACKEND[value] ?? null;
}

function mapTutor(raw: BackendTutor): Instructor {
  return {
    id: raw.id,
    fullName: raw.fullName,
    email: raw.email ?? "",
    phone: raw.phone,
    token: raw.accessToken ?? "",
    subjects: [],
    status: raw.isActive ? "active" : "inactive",
    createdAt: raw.createdAt,
  };
}

function mapStudent(raw: BackendStudent): Student {
  return {
    id: raw.id,
    fullName: raw.fullName,
    grade: ageGroupToGrade(raw.ageGroup),
    parentName: raw.parentName ?? "",
    parentPhone: raw.parentPhone ?? "",
    status: raw.isActive ? "active" : "inactive",
    createdAt: raw.createdAt,
  };
}

function mapReport(raw: BackendReport): Report {
  return {
    id: raw.id,
    assignmentId: raw.assignmentId,
    instructorId: raw.tutor?.id ?? "",
    studentId: raw.student?.id ?? "",
    subject: raw.course?.name ?? "",
    month: raw.month,
    topicsCovered: raw.topicsCovered ?? "",
    continuityNeeded: raw.continuityNeeded,
    continuityNote: raw.continuityNote ?? "",
    generalFeedback: raw.generalFeedback ?? "",
    tutorComment: raw.tutorComment ?? "",
    progressRating: mapRating(raw.progressRating),
    status: STATUS_FROM_BACKEND[raw.status] ?? "draft",
    submittedAt: raw.submittedAt,
    reviewedAt: raw.reviewedAt,
    reviewerNote: raw.revisionNote,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function mapReportWithContext(raw: BackendReport): ReportWithContext {
  return {
    ...mapReport(raw),
    instructorName: raw.tutor?.fullName ?? "Unknown tutor",
    studentName: raw.student?.fullName ?? "Unknown student",
    grade: ageGroupToGrade(raw.student?.ageGroup),
  };
}

function mapAssignment(raw: BackendAssignment): Assignment {
  return {
    id: raw.id,
    instructorId: raw.tutorId,
    studentId: raw.studentId,
    subject: raw.course?.name ?? "",
    createdAt: raw.createdAt,
  };
}

function mapSession(payload: { admin?: BackendAdmin } | null): AdminSession | null {
  if (!payload?.admin) return null;
  const admin = payload.admin;
  return {
    email: admin.email,
    name: admin.name,
    role: "admin",
    token: "",
    issuedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/*                              Auth                                   */
/* ------------------------------------------------------------------ */

export const auth = {
  async login(email: string, password: string): Promise<AdminSession> {
    const payload = await request<{ admin?: BackendAdmin }>("/auth/login", {
      method: "POST",
      body: { email: email.trim().toLowerCase(), password },
    });
    const session = mapSession(payload);
    if (!session) throw new ApiError("UNAUTHORIZED", "Incorrect email or password.");
    return session;
  },

  async logout(): Promise<void> {
    await request("/auth/logout", { method: "POST" });
  },

  async getSession(): Promise<AdminSession | null> {
    try {
      const payload = await request<{ admin?: BackendAdmin } | null>("/auth/session");
      return mapSession(payload);
    } catch {
      return null;
    }
  },
};

/* ------------------------------------------------------------------ */
/*                              Tutors                                 */
/* ------------------------------------------------------------------ */

async function listAll<T>(
  path: string,
  params: Record<string, QueryValue>,
  base?: string,
): Promise<T[]> {
  const pageSize = 100;
  const first = await request<{ rows?: T[]; hasNext?: boolean }>(path, {
    base,
    query: { ...params, page: 1, pageSize },
  });

  const rows: T[] = [...(first.rows ?? [])];
  let page = 2;
  while (first.hasNext) {
    const next = await request<{ rows?: T[]; hasNext?: boolean }>(path, {
      base,
      query: { ...params, page, pageSize },
    });
    if (!next.rows?.length) break;
    rows.push(...next.rows);
    if (!next.hasNext) break;
    page += 1;
    if (page > 100) break;
  }
  return rows;
}

export interface TutorListParams {
  search?: string;
  status?: "all" | "active" | "inactive";
}

export const tutors = {
  async list(params: TutorListParams = {}): Promise<Instructor[]> {
    const rows = await listAll<BackendTutor>("/tutors", {
      search: params.search,
      status: params.status,
    });
    return rows.map(mapTutor);
  },

  async create(values: InstructorFormValues): Promise<Instructor> {
    const raw = await request<BackendTutor>("/tutors", {
      method: "POST",
      body: {
        fullName: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
        phone: normalisePhone(values.phone),
      },
    });
    return mapTutor(raw);
  },

  async update(id: string, values: InstructorFormValues): Promise<Instructor> {
    const raw = await request<BackendTutor>(`/tutors/${id}`, {
      method: "PATCH",
      body: {
        fullName: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
        phone: normalisePhone(values.phone),
      },
    });
    return mapTutor(raw);
  },

  async setStatus(id: string, status: Instructor["status"]): Promise<Instructor> {
    const raw = await request<BackendTutor>(`/tutors/${id}/${status === "active" ? "activate" : "deactivate"}`, {
      method: "POST",
    });
    return mapTutor(raw);
  },

  async regenerateToken(id: string): Promise<Instructor> {
    const raw = await request<BackendTutor>(`/tutors/${id}/regenerate-link`, {
      method: "POST",
    });
    return mapTutor(raw);
  },

  async privateLink(id: string): Promise<string> {
    const link = await request<{
      portalUrl?: string;
      url?: string;
      token?: string;
      accessToken?: string;
      whatsappLink?: string | null;
      message?: string;
    }>(`/tutors/${id}/link`);
    if (link?.portalUrl || link?.url) return (link.portalUrl ?? link.url) as string;
    const token = link?.accessToken ?? link?.token;
    if (token) {
      const origin = typeof window === "undefined" ? "" : window.location.origin;
      return `${origin}/t/${token}`;
    }
    throw new ApiError("NOT_FOUND", "That tutor has no portal link yet.");
  },

  /** Full share payload: portal URL plus a ready-made WhatsApp message. */
  async shareLink(id: string): Promise<{
    portalUrl: string;
    whatsappLink: string | null;
    message: string;
  }> {
    const link = await request<{
      portalUrl?: string;
      url?: string;
      token?: string;
      accessToken?: string;
      whatsappLink?: string | null;
      message?: string;
    }>(`/tutors/${id}/link`);
    const portalUrl =
      link?.portalUrl ??
      link?.url ??
      (() => {
        const token = link?.accessToken ?? link?.token;
        if (!token) throw new ApiError("NOT_FOUND", "That tutor has no portal link yet.");
        const origin = typeof window === "undefined" ? "" : window.location.origin;
        return `${origin}/t/${token}`;
      })();
    return { portalUrl, whatsappLink: link?.whatsappLink ?? null, message: link?.message ?? "" };
  },
};

export const instructors = tutors;

/* ------------------------------------------------------------------ */
/*                              Students                               */
/* ------------------------------------------------------------------ */

export interface StudentListParams {
  search?: string;
  grade?: string | "all";
  subject?: string | "all";
  status?: "all" | "active" | "inactive";
}

export const students = {
  async list(params: StudentListParams = {}): Promise<Student[]> {
    const courseId = params.subject && params.subject !== "all"
      ? await courses.resolveId(params.subject)
      : undefined;
    const rows = await listAll<BackendStudent>("/students", {
      search: params.search,
      ageGroup: params.grade && params.grade !== "all" ? ageGroupFromGrade(params.grade) : undefined,
      courseId,
      status: params.status,
    });
    return rows.map(mapStudent);
  },

  async create(values: StudentFormValues): Promise<Student> {
    const raw = await request<BackendStudent>("/students", {
      method: "POST",
      body: {
        fullName: values.fullName.trim(),
        ageGroup: ageGroupFromGrade(values.grade),
        parentName: values.parentName.trim(),
        parentPhone: normalisePhone(values.parentPhone),
      },
    });
    return mapStudent(raw);
  },

  async update(id: string, values: StudentFormValues): Promise<Student> {
    const raw = await request<BackendStudent>(`/students/${id}`, {
      method: "PATCH",
      body: {
        fullName: values.fullName.trim(),
        ageGroup: ageGroupFromGrade(values.grade),
        parentName: values.parentName.trim(),
        parentPhone: normalisePhone(values.parentPhone),
      },
    });
    return mapStudent(raw);
  },

  async setStatus(id: string, status: Student["status"]): Promise<Student> {
    const raw = await request<BackendStudent>(`/students/${id}/${status === "active" ? "activate" : "deactivate"}`, {
      method: "POST",
    });
    return mapStudent(raw);
  },

  async getProfile(id: string): Promise<StudentProfile> {
    const payload = await request<{
      student: BackendStudent;
      assignments: Array<{ course: { name: string } }>;
      reports: BackendReport[];
      averageRating: number | null;
    }>(`/students/${id}/profile`);
    return {
      student: mapStudent(payload.student),
      subjects: [...new Set(payload.assignments.map((a) => a.course.name))],
      reports: payload.reports.map(mapReportWithContext),
      averageRating: payload.averageRating,
    };
  },
};

/* ------------------------------------------------------------------ */
/*                              Courses                                */
/* ------------------------------------------------------------------ */

export const courses = {
  async list(params: { search?: string; status?: "all" | "active" | "inactive" } = {}): Promise<Course[]> {
    const rows = await listAll<BackendCourse>("/courses", {
      search: params.search,
      status: params.status,
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      isActive: c.isActive,
      createdAt: c.createdAt,
    }));
  },

  async create(values: CourseFormValues): Promise<Course> {
    const raw = await request<BackendCourse>("/courses", {
      method: "POST",
      body: {
        name: values.name.trim(),
        category: values.category.trim(),
      },
    });
    return {
      id: raw.id,
      name: raw.name,
      category: raw.category,
      isActive: raw.isActive,
      createdAt: raw.createdAt,
    };
  },

  async update(id: string, values: CourseFormValues): Promise<Course> {
    const raw = await request<BackendCourse>(`/courses/${id}`, {
      method: "PATCH",
      body: {
        name: values.name.trim(),
        category: values.category.trim(),
      },
    });
    return {
      id: raw.id,
      name: raw.name,
      category: raw.category,
      isActive: raw.isActive,
      createdAt: raw.createdAt,
    };
  },

  async setStatus(id: string, active: boolean): Promise<Course> {
    const raw = await request<BackendCourse>(`/courses/${id}/${active ? "activate" : "deactivate"}`, {
      method: "POST",
    });
    return {
      id: raw.id,
      name: raw.name,
      category: raw.category,
      isActive: raw.isActive,
      createdAt: raw.createdAt,
    };
  },

  async remove(id: string): Promise<void> {
    await request(`/courses/${id}`, { method: "DELETE" });
  },

  async resolveId(name: string | undefined | null): Promise<string | undefined> {
    if (!name) return undefined;
    const all = await courses.list();
    return all.find((c) => c.name === name)?.id;
  },
};

/* ------------------------------------------------------------------ */
/*                              Assignments                            */
/* ------------------------------------------------------------------ */

export const assignments = {
  async list(): Promise<Assignment[]> {
    const rows = await listAll<BackendAssignment>("/assignments", {});
    return rows.map(mapAssignment);
  },

  async create(values: AssignmentFormValues): Promise<Assignment> {
    const raw = await request<BackendAssignment>("/assignments", {
      method: "POST",
      body: {
        tutorId: values.instructorId,
        studentId: values.studentId,
        courseId: values.subject,
        level: values.level,
      },
    });
    return mapAssignment(raw);
  },

  async remove(id: string): Promise<void> {
    await request(`/assignments/${id}`, { method: "DELETE" });
  },
};

/* ------------------------------------------------------------------ */
/*                              Reports                                */
/* ------------------------------------------------------------------ */

const SORT_TO_BACKEND: Record<ReportSortKey, string> = {
  studentName: "studentName",
  instructorName: "tutorName",
  subject: "courseName",
  month: "month",
  status: "status",
  progressRating: "progressRating",
  submittedAt: "submittedAt",
  updatedAt: "submittedAt",
};

export const reports = {
  async list(query: ReportQuery = {}): Promise<PaginatedResult<ReportWithContext>> {
    const courseId = query.subject && query.subject !== "all"
      ? await courses.resolveId(query.subject)
      : undefined;
    const result = await request<PaginatedResult<BackendReport>>("/reports", {
      query: {
        month: query.month === "all" ? undefined : query.month,
        tutorId: query.instructorId === "all" ? undefined : query.instructorId,
        studentId: query.studentId === "all" ? undefined : query.studentId,
        courseId,
        ageGroup: query.grade && query.grade !== "all" ? ageGroupFromGrade(query.grade) : undefined,
        status: query.status === "all" ? undefined : query.status,
        search: query.search,
        sort: query.sort ? SORT_TO_BACKEND[query.sort] : undefined,
        direction: query.direction,
        page: query.page,
        pageSize: query.pageSize,
      },
    });
    return {
      rows: (result.rows ?? []).map(mapReportWithContext),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      pageCount: result.pageCount,
    };
  },

  async get(id: string): Promise<ReportWithContext> {
    const raw = await request<BackendReport>(`/reports/${id}`);
    return mapReportWithContext(raw);
  },

  async markReviewed(id: string): Promise<ReportWithContext> {
    const raw = await request<BackendReport>(`/reports/${id}/review`, {
      method: "POST",
      body: {},
    });
    return mapReportWithContext(raw);
  },

  async requestRevision(id: string, note: string): Promise<ReportWithContext> {
    const raw = await request<BackendReport>(`/reports/${id}/request-revision`, {
      method: "POST",
      body: { note: note.trim() },
    });
    return mapReportWithContext(raw);
  },
};

export const reportsWithContext = {
  list: (query: ReportQuery = {}) => reports.list(query),
  get: (id: string) => reports.get(id),
};

/* ------------------------------------------------------------------ */
/*                              Portal                                 */
/* ------------------------------------------------------------------ */

interface BackendTutorCard {
  assignmentId: string;
  studentId: string;
  studentName: string;
  ageGroup: string;
  parentName: string | null;
  courseId: string;
  courseName: string;
  courseCategory: string;
  level: string;
  levelLabel: string;
  status: string;
  reportId: string | null;
  progressRating: string | null;
  submittedAt: string | null;
  updatedAt: string | null;
  revisionNote: string | null;
  report: BackendReport | null;
}

interface BackendTutorSelf {
  id: string;
  fullName: string;
  email: string | null;
  isActive: boolean;
}

interface BackendPortalPayload {
  month: string;
  tutor: BackendTutorSelf;
  students: BackendTutorCard[];
  summary: { total: number; submitted: number; inProgress: number; notStarted: number; needsRevision?: number };
}

const TUTOR_CARD_STATUS: Record<string, TutorCardStatus> = {
  NOT_STARTED: "not_started",
  DRAFT: "draft",
  SUBMITTED: "submitted",
  REVIEWED: "submitted",
  NEEDS_REVISION: "draft",
};

function mapCardStatus(value: string): TutorCardStatus {
  return TUTOR_CARD_STATUS[value] ?? "not_started";
}

function mapPortalPayload(payload: BackendPortalPayload): InstructorPortalData {
  const tutor: Instructor = {
    id: payload.tutor.id,
    fullName: payload.tutor.fullName,
    email: payload.tutor.email ?? "",
    phone: "",
    token: "",
    subjects: [],
    status: payload.tutor.isActive ? "active" : "inactive",
    createdAt: "",
  };
  const students = payload.students.map((card) => ({
    assignmentId: card.assignmentId,
    studentId: card.studentId,
    studentName: card.studentName,
    grade: ageGroupToGrade(card.ageGroup),
    subject: card.courseName,
    status: mapCardStatus(card.status),
    reportId: card.reportId,
    report: card.report
      ? mapReport({
          ...card.report,
          tutor: { id: tutor.id, fullName: tutor.fullName },
          student: {
            id: card.studentId,
            fullName: card.studentName,
            ageGroup: card.ageGroup,
          },
          course: { id: card.courseId, name: card.courseName },
        })
      : null,
  }));

  return {
    instructor: tutor,
    month: payload.month,
    students,
    summary: {
      total: payload.summary.total,
      submitted: payload.summary.submitted,
      inProgress: payload.summary.inProgress,
      notStarted: payload.summary.notStarted,
    },
  };
}

function mapTutorReport(raw: BackendReport): Report {
  return mapReport({ ...raw, tutor: undefined, student: undefined, course: undefined });
}

export const portal = {
  async getInstructor(token: string): Promise<Instructor> {
    setTutorToken(token);
    const raw = await request<BackendTutorSelf>("/me", { base: TUTOR_BASE, tutorAuth: true });
    return {
      id: raw.id,
      fullName: raw.fullName,
      email: raw.email ?? "",
      phone: "",
      token,
      subjects: [],
      status: raw.isActive ? "active" : "inactive",
      createdAt: "",
    };
  },

  async getPortal(token: string, month: string): Promise<InstructorPortalData> {
    setTutorToken(token);
    const payload = await request<BackendPortalPayload>("/assignments", {
      base: TUTOR_BASE,
      tutorAuth: true,
      query: { month },
    });
    return mapPortalPayload(payload);
  },

  async getPreviousReport(assignmentId: string, month: string): Promise<Report | null> {
    const payload = await request<{ month: string; report: BackendReport | null }>(
      `/reports/${assignmentId}/previous`,
      {
        base: TUTOR_BASE,
        tutorAuth: true,
        query: { month },
      },
    );
    return payload?.report ? mapTutorReport(payload.report) : null;
  },

  async copyFromPreviousMonth(assignmentId: string, month: string): Promise<Report> {
    const report = await portal.getPreviousReport(assignmentId, month);
    if (!report) throw new ApiError("NOT_FOUND", "There is no previous report to copy yet.");
    return report;
  },

  async saveDraft(
    assignmentId: string,
    month: string,
    draft: ReportDraftInput,
  ): Promise<Report> {
    const raw = await request<BackendReport>(`/reports/${assignmentId}`, {
      base: TUTOR_BASE,
      tutorAuth: true,
      method: "PUT",
      body: { ...toBackendDraft(draft), month },
    });
    return mapTutorReport(raw);
  },

  async submit(
    assignmentId: string,
    month: string,
    draft: ReportDraftInput,
  ): Promise<Report> {
    const raw = await request<BackendReport>(`/reports/${assignmentId}/submit`, {
      base: TUTOR_BASE,
      tutorAuth: true,
      method: "POST",
      body: { ...toBackendDraft(draft), month },
    });
    return mapTutorReport(raw);
  },
};

/* ------------------------------------------------------------------ */
/*                              Dashboard                              */
/* ------------------------------------------------------------------ */

interface BackendDashboard {
  month: string;
  stats: {
    totalTutors?: number;
    activeTutors?: number;
    totalStudents?: number;
    activeStudents?: number;
    totalCourses?: number;
    expected?: number;
    submitted?: number;
    pending?: number;
    inProgress?: number;
    needsRevision?: number;
    notStarted?: number;
    completionRate?: number;
  };
  outstanding: {
    rows: Array<{
      tutorId: string;
      fullName: string;
      phone: string;
      total: number;
      submitted: number;
      remaining: number;
      portalUrl: string;
      whatsappLink: string | null;
      reminderMessage: string | null;
    }>;
    complete: number;
    totalTutors: number;
  };
  recent: BackendReport[];
}

function mapDashboard(payload: BackendDashboard): DashboardData {
  return {
    month: payload.month,
    stats: {
      totalInstructors: payload.stats.totalTutors ?? 0,
      activeInstructors: payload.stats.activeTutors ?? 0,
      totalStudents: payload.stats.totalStudents ?? 0,
      activeStudents: payload.stats.activeStudents ?? 0,
      submitted: payload.stats.submitted ?? 0,
      pending: payload.stats.pending ?? 0,
      expected: payload.stats.expected ?? 0,
    },
    outstanding: payload.outstanding.rows.map((t) => ({
      instructor: {
        id: t.tutorId,
        fullName: t.fullName,
        email: "",
        phone: t.phone,
        token: "",
        subjects: [],
        status: "active" as const,
        createdAt: "",
      },
      total: t.total ?? 0,
      submitted: t.submitted ?? 0,
      outstanding: t.remaining ?? 0,
      students: [],
      portalUrl: t.portalUrl,
      whatsappLink: t.whatsappLink,
      reminderMessage: t.reminderMessage,
    })),
    recent: payload.recent.map(mapReportWithContext),
  };
}

export const dashboard = {
  async get(month: string): Promise<DashboardData> {
    const payload = await request<BackendDashboard>("/dashboard", { query: { month } });
    return mapDashboard(payload);
  },
};

/* ------------------------------------------------------------------ */
/*                              Bulk import                            */
/* ------------------------------------------------------------------ */

interface BackendImportPreview {
  type: string;
  totalRows: number;
  validCount: number;
  errorCount: number;
  creatableCount: number;
  rows: {
    row: number;
    status: "valid" | "error";
    action: "create" | "skip" | string;
    values: Record<string, string>;
    errors: Record<string, string>;
    message: string | null;
  }[];
}

interface BackendImportCommit extends BackendImportPreview {
  committed: boolean;
  created: string[];
  skipped: string[];
  createdCount: number;
  skippedCount: number;
  errors: string[];
  preview: BackendImportPreview;
}

function mapImportPreview(payload: BackendImportPreview): ImportPreview {
  return {
    kind: (payload.type === "tutors" ? "instructors" : payload.type) as ImportKind,
    rows: payload.rows.map((row) => ({
      rowNumber: row.row,
      raw: row.values,
      values: row.values as Partial<Instructor> | Partial<Student>,
      errors: [...Object.values(row.errors), ...(row.message ? [row.message] : [])],
    })),
    validCount: payload.validCount,
    errorCount: payload.errorCount,
    duplicateCount: 0,
  };
}

function mapImportCommit(payload: BackendImportCommit): ImportResult {
  return {
    created: payload.createdCount,
    skipped: payload.skippedCount,
    failed: payload.errorCount,
  };
}

async function postImportFile<T>(kind: ImportKind, file: File, dryRun: boolean): Promise<T> {
  const type = kind === "instructors" ? "tutors" : "students";
  const form = new FormData();
  form.append("file", file, file.name);
  const url = new URL(
    `${ADMIN_BASE}/import/${type}?dryRun=${dryRun ? "true" : "false"}`,
    typeof window === "undefined" ? "http://localhost:3000" : window.location.origin,
  );
  const res = await fetch(url.toString(), { method: "POST", body: form, credentials: "include" });
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiError("INTERNAL_ERROR", `Unexpected response (${res.status}).`);
  }
  const data = (await res.json()) as T | ErrorEnvelope;
  if ((data as ErrorEnvelope).success === false) {
    const err = (data as ErrorEnvelope).error;
    throw new ApiError(mapErrorCode(err.code), err.message, toFieldErrors(err.details));
  }
  const payload = (data as any).data;
  return (payload as T) ?? (data as T);
}

export const bulkImport = {
  async preview(kind: ImportKind, file: File): Promise<ImportPreview> {
    const payload = await postImportFile<BackendImportPreview>(kind, file, true);
    return mapImportPreview(payload);
  },

  async commit(kind: ImportKind, file: File): Promise<ImportResult> {
    const payload = await postImportFile<BackendImportCommit>(kind, file, false);
    return mapImportCommit(payload);
  },

  columnsFor(kind: ImportKind): string[] {
    return kind === "instructors"
      ? ["Full name", "Email", "Phone"]
      : ["Full name", "Age group", "Parent name", "Parent phone", "Parent email"];
  },
};

/* ------------------------------------------------------------------ */
/*                              Documents                              */
/* ------------------------------------------------------------------ */

export const documents = {
  async downloadPdf(reportId: string): Promise<void> {
    await download(`/reports/${reportId}/pdf`, `report-${reportId}.pdf`);
  },

  async downloadWord(reportId: string): Promise<void> {
    await download(`/reports/${reportId}/docx`, `report-${reportId}.docx`);
  },
};

/* ------------------------------------------------------------------ */
/*                              Validators                             */
/* ------------------------------------------------------------------ */

export type DraftFieldErrors = Record<string, string | undefined>;

export function validateDraft(draft: ReportDraftInput): DraftFieldErrors {
  const errors: DraftFieldErrors = {};
  if (draft.topicsCovered.trim().length < 10)
    errors.topicsCovered = "Tell us what you covered — at least 10 characters.";
  if (draft.continuityNeeded && !draft.continuityNote.trim())
    errors.continuityNote = "Explain what continuity is needed.";
  if (draft.generalFeedback.trim().length < 10)
    errors.generalFeedback = "General feedback is required (at least 10 characters).";
  if (draft.tutorComment.trim().length < 5)
    errors.tutorComment = "Add a short tutor comment (at least 5 characters).";
  if (!draft.progressRating) errors.progressRating = "Select a progress rating.";
  return errors;
}

export function columnsFor(kind: ImportKind): string[] {
  return kind === "instructors"
    ? ["fullName", "email", "phone"]
    : ["fullName", "grade", "parentName", "parentPhone"];
}
