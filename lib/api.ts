/* ------------------------------------------------------------------ *
 * THE API LAYER
 *
 * Every screen in this app talks to the backend through the functions in
 * this file and nothing else. Right now each function is served by the
 * in-memory mock database in `lib/mock-data.ts` with a little artificial
 * latency, so the UI can be built and demoed without a server.
 *
 * ┌───────────────────────────────────────────────────────────────────┐
 * │ TO SWAP IN THE EXPRESS BACKEND                                   │
 * │ 1. Set NEXT_PUBLIC_USE_MOCK_API=false                             │
 * │ 2. Point NEXT_PUBLIC_API_BASE_URL at the Express origin           │
 * │ 3. Implement the matching routes (method + path + response shape) │
 * │    listed in the ROUTES table below. No UI file changes needed.    │
 * └───────────────────────────────────────────────────────────────────┘
 *
 * ROUTES
 *   POST   /auth/login                     -> AdminSession
 *   GET    /instructors                    -> Instructor[]
 *   POST   /instructors                    -> Instructor
 *   PATCH  /instructors/:id                -> Instructor
 *   DELETE /instructors/:id                -> { id }
 *   GET    /students                       -> Student[]
 *   POST   /students                       -> Student
 *   PATCH  /students/:id                   -> Student
 *   DELETE /students/:id                   -> { id }
 *   GET    /assignments                    -> Assignment[]
 *   POST   /assignments                    -> Assignment
 *   DELETE /assignments/:id                -> { id }
 *   GET    /reports?month=&…&page=         -> PaginatedResult<ReportWithContext>
 *   GET    /reports/:id                    -> ReportWithContext
 *   PATCH  /reports/:id                    -> Report            (draft / review actions)
 *   GET    /instructors/:token/portal?month= -> InstructorPortalData
 *   GET    /dashboard?month=               -> DashboardData
 *   GET    /students/:id/profile           -> StudentProfile
 *   POST   /import/preview                 -> ImportPreview
 *   POST   /import/commit                  -> ImportResult
 * ------------------------------------------------------------------ */

import { DEMO_ADMIN } from "@/lib/constants";
import { MOCK_DB, type MockDatabase } from "@/lib/mock-data";
import {
  ApiError,
  PROGRESS_RATINGS,
  type AdminSession,
  type Assignment,
  type AssignmentFormValues,
  type DashboardData,
  type ImportKind,
  type ImportPreview,
  type ImportResult,
  type ImportRow,
  type Instructor,
  type InstructorFormValues,
  type InstructorPortalData,
  type MonthKey,
  type PaginatedResult,
  type PortalStudentCard,
  type PortalSummary,
  type ProgressRating,
  type Report,
  type ReportDraftInput,
  type ReportQuery,
  type ReportSortKey,
  type ReportStatus,
  type ReportWithContext,
  type SortDirection,
  type Student,
  type StudentFormValues,
  type StudentProfile,
  type TutorCardStatus,
} from "@/lib/types";
import {
  firstName,
  formatMonth,
  getCurrentMonth,
  initials,
  isFutureMonth,
  normalisePhone,
  pluralise,
} from "@/lib/utils";

/* ------------------------------ Transport ------------------------------ */

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCK_API !== "false";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";
const LATENCY_MS = Number(process.env.NEXT_PUBLIC_MOCK_LATENCY ?? 380);

type QueryValue = string | number | boolean | undefined | null;

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
  /** Set for mutating calls so the mock store persists across hot reloads. */
  mutate?: (db: MockDatabase) => unknown;
}

/**
 * Single choke point for data access. In mock mode it runs the local
 * handler against the seeded store; otherwise it performs a real request.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!USE_MOCKS) {
    const url = new URL(`${API_BASE}${path}`, window.location.origin);
    Object.entries(options.query ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });

    const response = await fetch(url.toString(), {
      method: options.method ?? "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new ApiError(
        (payload?.code as never) ?? "NOT_FOUND",
        payload?.message ?? `Request failed (${response.status})`,
        payload?.fieldErrors,
      );
    }

    return (await response.json()) as T;
  }

  await new Promise((resolve) => setTimeout(resolve, LATENCY_MS + Math.random() * 220));
  if (!options.mutate) {
    throw new ApiError(
      "NOT_FOUND",
      `No mock handler registered for ${options.method ?? "GET"} ${path}. Add one in lib/api.ts.`,
    );
  }
  return options.mutate(getStore()) as T;
}

/**
 * The store is cached on `globalThis` so mutations survive Next.js hot
 * reloads in development. A real backend makes this file disappear.
 */
function getStore(): MockDatabase {
  const cache = globalThis as typeof globalThis & { __techcitiDb?: MockDatabase };
  if (!cache.__techcitiDb) {
    cache.__techcitiDb = structuredClone(MOCK_DB);
  }
  return cache.__techcitiDb;
}

/** Test/demo helper: resets the in-memory database back to the seed. */
export async function resetMockData(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const cache = globalThis as typeof globalThis & { __techcitiDb?: MockDatabase };
  cache.__techcitiDb = structuredClone(MOCK_DB);
}

/* -------------------------------- Helpers -------------------------------- */

let idCounter = 0;
function makeId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}`;
}

function tokenFor(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

function findInstructor(db: MockDatabase, id: string): Instructor {
  const tutor = db.instructors.find((candidate) => candidate.id === id);
  if (!tutor) throw new ApiError("NOT_FOUND", "Tutor not found.");
  return tutor;
}

function findStudent(db: MockDatabase, id: string): Student {
  const student = db.students.find((candidate) => candidate.id === id);
  if (!student) throw new ApiError("NOT_FOUND", "Student not found.");
  return student;
}

function cardStatus(report: Report | undefined): TutorCardStatus {
  if (!report) return "not_started";
  if (report.status === "draft") return "draft";
  return "submitted";
}

function withContext(db: MockDatabase, report: Report): ReportWithContext {
  const tutor = db.instructors.find((candidate) => candidate.id === report.instructorId);
  const student = db.students.find((candidate) => candidate.id === report.studentId);
  return {
    ...report,
    instructorName: tutor?.fullName ?? "Unknown tutor",
    studentName: student?.fullName ?? "Unknown student",
    grade: student?.grade ?? "—",
  };
}

function ratingRank(rating: ProgressRating | null): number {
  if (!rating) return -1;
  return PROGRESS_RATINGS.indexOf(rating);
}

/* ============================ AUTHENTICATION ============================ */

const SESSION_KEY = "techciti.admin.session";

export const auth = {
  async login(email: string, password: string): Promise<AdminSession> {
    return request<AdminSession>("/auth/login", {
      method: "POST",
      body: { email: email.trim().toLowerCase(), password },
      mutate: () => {
        if (
          email.trim().toLowerCase() !== DEMO_ADMIN.email ||
          password !== DEMO_ADMIN.password
        ) {
          throw new ApiError("UNAUTHORIZED", "Incorrect email or password.");
        }
        const session: AdminSession = {
          email: DEMO_ADMIN.email,
          name: "TechCiti Admin",
          role: "admin",
          token: `mock_${Math.random().toString(36).slice(2)}`,
          issuedAt: new Date().toISOString(),
        };
        if (typeof window !== "undefined") {
          window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        }
        return session;
      },
    });
  },

  async logout(): Promise<void> {
    if (typeof window !== "undefined") window.localStorage.removeItem(SESSION_KEY);
    await new Promise((resolve) => setTimeout(resolve, 120));
  },

  /** Reads the stored session (client-side only; the real app uses a cookie). */
  async getSession(): Promise<AdminSession | null> {
    await new Promise((resolve) => setTimeout(resolve, 80));
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AdminSession;
    } catch {
      return null;
    }
  },
};

/* ============================== INSTRUCTORS ============================== */

export interface InstructorListParams {
  search?: string;
  status?: "all" | "active" | "inactive";
}

export const instructors = {
  async list(params: InstructorListParams = {}): Promise<Instructor[]> {
    return request<Instructor[]>("/instructors", {
      query: { search: params.search, status: params.status },
      mutate: (db) => {
        const search = params.search?.trim().toLowerCase() ?? "";
        return db.instructors
          .filter((tutor) => (params.status && params.status !== "all" ? tutor.status === params.status : true))
          .filter((tutor) =>
            search
              ? [tutor.fullName, tutor.email, ...tutor.subjects]
                  .join(" ")
                  .toLowerCase()
                  .includes(search)
              : true,
          )
          .sort((a, b) => a.fullName.localeCompare(b.fullName));
      },
    });
  },

  async create(values: InstructorFormValues): Promise<Instructor> {
    return request<Instructor>("/instructors", {
      method: "POST",
      body: values,
      mutate: (db) => {
        const errors = validateInstructor(values);
        if (Object.keys(errors).length) throw new ApiError("VALIDATION", "Please fix the highlighted fields.", errors);
        if (db.instructors.some((tutor) => tutor.email.toLowerCase() === values.email.toLowerCase())) {
          throw new ApiError("CONFLICT", "A tutor with this email already exists.", {
            email: "This email is already in use.",
          });
        }
        const tutor: Instructor = {
          id: makeId("tut"),
          fullName: values.fullName.trim(),
          email: values.email.trim().toLowerCase(),
          phone: normalisePhone(values.phone),
          token: tokenFor(values.fullName),
          subjects: values.subjects,
          status: "active",
          createdAt: new Date().toISOString(),
        };
        db.instructors.unshift(tutor);
        return tutor;
      },
    });
  },

  async update(id: string, values: InstructorFormValues): Promise<Instructor> {
    return request<Instructor>(`/instructors/${id}`, {
      method: "PATCH",
      body: values,
      mutate: (db) => {
        const errors = validateInstructor(values);
        if (Object.keys(errors).length) throw new ApiError("VALIDATION", "Please fix the highlighted fields.", errors);
        const tutor = findInstructor(db, id);
        if (
          db.instructors.some(
            (candidate) => candidate.id !== id && candidate.email.toLowerCase() === values.email.toLowerCase(),
          )
        ) {
          throw new ApiError("CONFLICT", "A tutor with this email already exists.", {
            email: "This email is already in use.",
          });
        }
        Object.assign(tutor, {
          fullName: values.fullName.trim(),
          email: values.email.trim().toLowerCase(),
          phone: normalisePhone(values.phone),
          subjects: values.subjects,
        });
        return tutor;
      },
    });
  },

  async setStatus(id: string, status: Instructor["status"]): Promise<Instructor> {
    return request<Instructor>(`/instructors/${id}`, {
      method: "PATCH",
      body: { status },
      mutate: (db) => {
        const tutor = findInstructor(db, id);
        tutor.status = status;
        return tutor;
      },
    });
  },

  async regenerateToken(id: string): Promise<Instructor> {
    return request<Instructor>(`/instructors/${id}/token`, {
      method: "PATCH",
      mutate: (db) => {
        const tutor = findInstructor(db, id);
        tutor.token = tokenFor(tutor.fullName);
        return tutor;
      },
    });
  },

  /** The tutor's private portal link — absolute, ready to paste into WhatsApp. */
  async privateLink(id: string): Promise<string> {
    const tutor = await request<Instructor>(`/instructors/${id}/link`, {
      mutate: (db) => findInstructor(db, id),
    });
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return `${origin}/t/${tutor.token}`;
  },
};

/* =============================== STUDENTS =============================== */

export interface StudentListParams {
  search?: string;
  grade?: string | "all";
  subject?: string | "all";
  status?: "all" | "active" | "inactive";
}

export const students = {
  async list(params: StudentListParams = {}): Promise<Student[]> {
    return request<Student[]>("/students", {
      query: { search: params.search, grade: params.grade, subject: params.subject, status: params.status },
      mutate: (db) => {
        const search = params.search?.trim().toLowerCase() ?? "";
        return db.students
          .filter((student) => (params.status && params.status !== "all" ? student.status === params.status : true))
          .filter((student) => (params.grade && params.grade !== "all" ? student.grade === params.grade : true))
          .filter((student) =>
            params.subject && params.subject !== "all"
              ? db.assignments.some(
                  (assignment) => assignment.studentId === student.id && assignment.subject === params.subject,
                )
              : true,
          )
          .filter((student) =>
            search
              ? [student.fullName, student.grade, student.parentName]
                  .join(" ")
                  .toLowerCase()
                  .includes(search)
              : true,
          )
          .sort((a, b) => a.fullName.localeCompare(b.fullName));
      },
    });
  },

  async create(values: StudentFormValues): Promise<Student> {
    return request<Student>("/students", {
      method: "POST",
      body: values,
      mutate: (db) => {
        const errors = validateStudent(values);
        if (Object.keys(errors).length) throw new ApiError("VALIDATION", "Please fix the highlighted fields.", errors);
        if (
          db.students.some((student) => student.fullName.toLowerCase() === values.fullName.trim().toLowerCase())
        ) {
          throw new ApiError("CONFLICT", "A student with this name already exists.", {
            fullName: "This student already exists.",
          });
        }
        const student: Student = {
          id: makeId("stu"),
          fullName: values.fullName.trim(),
          grade: values.grade,
          gender: values.gender,
          parentName: values.parentName.trim(),
          parentPhone: normalisePhone(values.parentPhone),
          status: "active",
          createdAt: new Date().toISOString(),
        };
        db.students.unshift(student);
        return student;
      },
    });
  },

  async update(id: string, values: StudentFormValues): Promise<Student> {
    return request<Student>(`/students/${id}`, {
      method: "PATCH",
      body: values,
      mutate: (db) => {
        const errors = validateStudent(values);
        if (Object.keys(errors).length) throw new ApiError("VALIDATION", "Please fix the highlighted fields.", errors);
        const student = findStudent(db, id);
        Object.assign(student, {
          fullName: values.fullName.trim(),
          grade: values.grade,
          gender: values.gender,
          parentName: values.parentName.trim(),
          parentPhone: normalisePhone(values.parentPhone),
        });
        return student;
      },
    });
  },

  async setStatus(id: string, status: Student["status"]): Promise<Student> {
    return request<Student>(`/students/${id}`, {
      method: "PATCH",
      body: { status },
      mutate: (db) => {
        const student = findStudent(db, id);
        student.status = status;
        return student;
      },
    });
  },

  async getProfile(id: string): Promise<StudentProfile> {
    return request<StudentProfile>(`/students/${id}/profile`, {
      mutate: (db) => {
        const student = findStudent(db, id);
        const assignments = db.assignments.filter((assignment) => assignment.studentId === id);
        const reports = db.reports
          .filter((report) => report.studentId === id)
          .sort((a, b) => b.month.localeCompare(a.month))
          .map((report) => withContext(db, report));
        const rated = reports.filter((report) => report.progressRating);
        const averageRating = rated.length
          ? rated.reduce((total, report) => total + ratingRank(report.progressRating), 0) / rated.length
          : null;
        return {
          student,
          reports,
          subjects: [...new Set(assignments.map((assignment) => assignment.subject))],
          averageRating,
        };
      },
    });
  },
};

/* ============================== ASSIGNMENTS ============================== */

export const assignments = {
  async list(): Promise<Assignment[]> {
    return request<Assignment[]>("/assignments", { mutate: (db) => db.assignments });
  },

  async create(values: AssignmentFormValues): Promise<Assignment> {
    return request<Assignment>("/assignments", {
      method: "POST",
      body: values,
      mutate: (db) => {
        const errors = validateAssignment(values);
        if (Object.keys(errors).length) throw new ApiError("VALIDATION", "Please fix the highlighted fields.", errors);
        const duplicate = db.assignments.some(
          (assignment) =>
            assignment.instructorId === values.instructorId &&
            assignment.studentId === values.studentId &&
            assignment.subject === values.subject,
        );
        if (duplicate) {
          throw new ApiError("CONFLICT", "This tutor is already assigned to that student for that subject.");
        }
        const assignment: Assignment = {
          id: makeId("asg"),
          instructorId: values.instructorId,
          studentId: values.studentId,
          subject: values.subject,
          createdAt: new Date().toISOString(),
        };
        db.assignments.push(assignment);
        return assignment;
      },
    });
  },

  async remove(id: string): Promise<{ id: string }> {
    return request<{ id: string }>(`/assignments/${id}`, {
      method: "DELETE",
      mutate: (db) => {
        db.assignments = db.assignments.filter((assignment) => assignment.id !== id);
        return { id };
      },
    });
  },
};

/* ================================ REPORTS ================================ */

export const reports = {
  async list(query: ReportQuery = {}): Promise<PaginatedResult<ReportWithContext>> {
    return request<PaginatedResult<ReportWithContext>>("/reports", {
      query: {
        month: query.month,
        instructorId: query.instructorId,
        studentId: query.studentId,
        grade: query.grade,
        subject: query.subject,
        status: query.status,
        search: query.search,
        sort: query.sort,
        direction: query.direction,
        page: query.page,
        pageSize: query.pageSize,
      },
      mutate: (db) => {
        const search = query.search?.trim().toLowerCase() ?? "";
        let rows = db.reports.map((report) => withContext(db, report));

        if (query.month && query.month !== "all") rows = rows.filter((row) => row.month === query.month);
        if (query.instructorId && query.instructorId !== "all")
          rows = rows.filter((row) => row.instructorId === query.instructorId);
        if (query.studentId && query.studentId !== "all")
          rows = rows.filter((row) => row.studentId === query.studentId);
        if (query.grade && query.grade !== "all") rows = rows.filter((row) => row.grade === query.grade);
        if (query.subject && query.subject !== "all") rows = rows.filter((row) => row.subject === query.subject);
        if (query.status && query.status !== "all") rows = rows.filter((row) => row.status === query.status);
        if (search)
          rows = rows.filter((row) =>
            [row.studentName, row.instructorName, row.subject, row.generalFeedback, row.topicsCovered]
              .join(" ")
              .toLowerCase()
              .includes(search),
          );

        rows = sortReports(rows, query.sort ?? "updatedAt", query.direction ?? "desc");

        const pageSize = query.pageSize ?? 10;
        const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
        const page = Math.min(Math.max(1, query.page ?? 1), pageCount);
        const start = (page - 1) * pageSize;

        return { rows: rows.slice(start, start + pageSize), total: rows.length, page, pageSize, pageCount };
      },
    });
  },

  async get(id: string): Promise<ReportWithContext> {
    return request<ReportWithContext>(`/reports/${id}`, {
      mutate: (db) => {
        const report = db.reports.find((candidate) => candidate.id === id);
        if (!report) throw new ApiError("NOT_FOUND", "Report not found.");
        return withContext(db, report);
      },
    });
  },

  async markReviewed(id: string): Promise<ReportWithContext> {
    return request<ReportWithContext>(`/reports/${id}`, {
      method: "PATCH",
      body: { status: "reviewed" },
      mutate: (db) => {
        const report = db.reports.find((candidate) => candidate.id === id);
        if (!report) throw new ApiError("NOT_FOUND", "Report not found.");
        report.status = "reviewed";
        report.reviewedAt = new Date().toISOString();
        report.reviewerNote = null;
        report.updatedAt = new Date().toISOString();
        return withContext(db, report);
      },
    });
  },

  async requestRevision(id: string, note: string): Promise<ReportWithContext> {
    return request<ReportWithContext>(`/reports/${id}`, {
      method: "PATCH",
      body: { status: "needs_revision", reviewerNote: note.trim() },
      mutate: (db) => {
        const report = db.reports.find((candidate) => candidate.id === id);
        if (!report) throw new ApiError("NOT_FOUND", "Report not found.");
        if (!note.trim())
          throw new ApiError("VALIDATION", "Please tell the tutor what needs changing.", {
            reviewerNote: "A note is required when requesting a revision.",
          });
        report.status = "needs_revision";
        report.reviewerNote = note.trim();
        report.updatedAt = new Date().toISOString();
        return withContext(db, report);
      },
    });
  },
};

/** Convenience alias — same endpoint, reads better inside the report tables. */
export const reportsWithContext = {
  list: (query: ReportQuery = {}) => reports.list(query),
  get: (id: string) => reports.get(id),
};

function sortReports(
  rows: ReportWithContext[],
  key: ReportSortKey,
  direction: SortDirection,
): ReportWithContext[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    switch (key) {
      case "progressRating":
        return (ratingRank(a.progressRating) - ratingRank(b.progressRating)) * factor;
      case "submittedAt":
      case "updatedAt":
        return ((a[key] ?? "").localeCompare(b[key] ?? "")) * factor;
      default:
        return a[key].localeCompare(b[key]) * factor;
    }
  });
}

/* ========================== INSTRUCTOR PORTAL API ========================== */

export const portal = {
  /** Resolves a private link token. Throws NOT_FOUND for an invalid token. */
  async getInstructor(token: string): Promise<Instructor> {
    return request<Instructor>("/instructors/by-token", {
      query: { token },
      mutate: (db) => {
        const tutor = db.instructors.find((candidate) => candidate.token === token);
        if (!tutor) throw new ApiError("NOT_FOUND", "This link is not valid.");
        return tutor;
      },
    });
  },

  /** Everything the tutor's home screen needs for one month, in one round trip. */
  async getPortal(token: string, month: MonthKey = getCurrentMonth()): Promise<InstructorPortalData> {
    return request<InstructorPortalData>("/instructors/portal", {
      query: { token, month },
      mutate: (db) => {
        const tutor = db.instructors.find((candidate) => candidate.token === token);
        if (!tutor) throw new ApiError("NOT_FOUND", "This link is not valid.");

        const tutorAssignments = db.assignments.filter(
          (assignment) => assignment.instructorId === tutor.id,
        );

        const cards: PortalStudentCard[] = tutorAssignments
          .map((assignment) => {
            const student = db.students.find((candidate) => candidate.id === assignment.studentId);
            if (!student) return null;
            const report =
              db.reports.find(
                (candidate) =>
                  candidate.assignmentId === assignment.id && candidate.month === month,
              ) ?? null;
            return {
              assignmentId: assignment.id,
              studentId: student.id,
              studentName: student.fullName,
              grade: student.grade,
              subject: assignment.subject,
              status: cardStatus(report ?? undefined),
              reportId: report?.id ?? null,
              report,
            } satisfies PortalStudentCard;
          })
          .filter((card): card is PortalStudentCard => card !== null)
          .sort((a, b) => a.studentName.localeCompare(b.studentName));

        const summary: PortalSummary = {
          total: cards.length,
          submitted: cards.filter((card) => card.status === "submitted").length,
          inProgress: cards.filter((card) => card.status === "draft").length,
          notStarted: cards.filter((card) => card.status === "not_started").length,
        };

        return { instructor: tutor, month, students: cards, summary };
      },
    });
  },

  /** Copies the previous month's answers into a new draft. */
  async copyFromPreviousMonth(assignmentId: string, month: MonthKey): Promise<Report> {
    return request<Report>("/reports/copy-previous", {
      method: "POST",
      body: { assignmentId, month },
      mutate: (db) => {
        const assignment = db.assignments.find((candidate) => candidate.id === assignmentId);
        if (!assignment) throw new ApiError("NOT_FOUND", "Assignment not found.");

        const previousKey = shift(month, -1);
        const previous = db.reports.find(
          (candidate) => candidate.assignmentId === assignmentId && candidate.month === previousKey,
        );

        const existing = db.reports.find(
          (candidate) => candidate.assignmentId === assignmentId && candidate.month === month,
        );

        const next: Report = existing ?? {
          id: makeId("rep"),
          assignmentId: assignment.id,
          instructorId: assignment.instructorId,
          studentId: assignment.studentId,
          subject: assignment.subject,
          month,
          topicsCovered: "",
          continuityNeeded: false,
          continuityNote: "",
          generalFeedback: "",
          tutorComment: "",
          progressRating: null,
          status: "draft",
          submittedAt: null,
          reviewedAt: null,
          reviewerNote: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (previous) {
          next.topicsCovered = previous.topicsCovered;
          next.continuityNeeded = previous.continuityNeeded;
          next.continuityNote = previous.continuityNote;
          next.generalFeedback = previous.generalFeedback;
          next.tutorComment = previous.tutorComment;
          next.progressRating = previous.progressRating;
        }

        next.updatedAt = new Date().toISOString();
        if (!existing) db.reports.push(next);
        return next;
      },
    });
  },

  /** Autosave target — always returns the persisted draft. */
  async saveDraft(
    assignmentId: string,
    month: MonthKey,
    draft: ReportDraftInput,
  ): Promise<Report> {
    return request<Report>("/reports/draft", {
      method: "PATCH",
      body: { assignmentId, month, ...draft },
      mutate: (db) => {
        const assignment = db.assignments.find((candidate) => candidate.id === assignmentId);
        if (!assignment) throw new ApiError("NOT_FOUND", "Assignment not found.");

        const existing = db.reports.find(
          (candidate) => candidate.assignmentId === assignmentId && candidate.month === month,
        );

        const next: Report = existing ?? {
          id: makeId("rep"),
          assignmentId: assignment.id,
          instructorId: assignment.instructorId,
          studentId: assignment.studentId,
          subject: assignment.subject,
          month,
          status: "draft",
          submittedAt: null,
          reviewedAt: null,
          reviewerNote: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...blankDraft(),
        };

        // Never resurrect a submitted report through autosave.
        if (existing && existing.status !== "draft") return existing;

        Object.assign(next, draft, {
          updatedAt: new Date().toISOString(),
          status: "draft",
        });

        if (!existing) db.reports.push(next);
        return next;
      },
    });
  },

  async submit(assignmentId: string, month: MonthKey, draft: ReportDraftInput): Promise<Report> {
    return request<Report>("/reports/submit", {
      method: "POST",
      body: { assignmentId, month, ...draft },
      mutate: (db) => {
        const assignment = db.assignments.find((candidate) => candidate.id === assignmentId);
        if (!assignment) throw new ApiError("NOT_FOUND", "Assignment not found.");
        if (isFutureMonth(month))
          throw new ApiError("VALIDATION", "You cannot submit a report for a future month.");

        const fieldErrors = validateDraft(draft);
        if (Object.keys(fieldErrors).length)
          throw new ApiError("VALIDATION", "Please complete the highlighted fields.", fieldErrors);

        const existing = db.reports.find(
          (candidate) => candidate.assignmentId === assignmentId && candidate.month === month,
        );

        if (existing && existing.status !== "draft") {
          throw new ApiError(
            "DUPLICATE_REPORT",
            `A report for ${formatMonth(month)} has already been submitted for this student.`,
          );
        }

        const now = new Date().toISOString();
        const next: Report = existing ?? {
          id: makeId("rep"),
          assignmentId: assignment.id,
          instructorId: assignment.instructorId,
          studentId: assignment.studentId,
          subject: assignment.subject,
          month,
          status: "draft",
          submittedAt: null,
          reviewedAt: null,
          reviewerNote: null,
          createdAt: now,
          updatedAt: now,
          ...blankDraft(),
        };

        Object.assign(next, draft, {
          status: "submitted" as ReportStatus,
          submittedAt: now,
          updatedAt: now,
          reviewerNote: null,
          reviewedAt: null,
        });

        if (!existing) db.reports.push(next);
        return next;
      },
    });
  },
};

function blankDraft(): ReportDraftInput {
  return {
    topicsCovered: "",
    continuityNeeded: false,
    continuityNote: "",
    generalFeedback: "",
    tutorComment: "",
    progressRating: null,
  };
}

function shift(month: MonthKey, delta: number): MonthKey {
  const [yearPart, monthPart] = month.split("-");
  const zeroBased = Number(yearPart) * 12 + (Number(monthPart) - 1) + delta;
  const nextYear = Math.floor(zeroBased / 12);
  const nextMonth = (zeroBased % 12 + 12) % 12 + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

/* =============================== DASHBOARD =============================== */

export const dashboard = {
  async get(month: MonthKey = getCurrentMonth()): Promise<DashboardData> {
    return request<DashboardData>("/dashboard", {
      query: { month },
      mutate: (db) => {
        const activeTutors = db.instructors.filter((tutor) => tutor.status === "active");
        const activeStudents = db.students.filter((student) => student.status === "active");
        const activeTutorIds = new Set(activeTutors.map((tutor) => tutor.id));

        const expectedAssignments = db.assignments.filter((assignment) =>
          activeTutorIds.has(assignment.instructorId),
        );
        const monthReports = db.reports.filter((report) => report.month === month);
        const submittedReports = monthReports.filter(
          (report) => report.status === "submitted" || report.status === "reviewed",
        );
        const submitted = submittedReports.length;
        const expected = expectedAssignments.length;

        const outstanding = activeTutors
          .map((tutor) => {
            const tutorAssignments = expectedAssignments.filter(
              (assignment) => assignment.instructorId === tutor.id,
            );
            const done = new Set(
              submittedReports
                .filter((report) => report.instructorId === tutor.id)
                .map((report) => report.assignmentId),
            );
            const pendingAssignments = tutorAssignments.filter(
              (assignment) => !done.has(assignment.id),
            );
            return {
              instructor: tutor,
              total: tutorAssignments.length,
              submitted: tutorAssignments.length - pendingAssignments.length,
              outstanding: pendingAssignments.length,
              students: pendingAssignments.map((assignment) => {
                const student = db.students.find(
                  (candidate) => candidate.id === assignment.studentId,
                );
                return student?.fullName ?? "Unknown student";
              }),
            };
          })
          .filter((entry) => entry.outstanding > 0)
          .sort((a, b) => b.outstanding - a.outstanding);

        const recent = [...monthReports]
          .sort((a, b) => (b.submittedAt ?? b.updatedAt).localeCompare(a.submittedAt ?? a.updatedAt))
          .slice(0, 6)
          .map((report) => withContext(db, report));

        return {
          month,
          stats: {
            totalInstructors: db.instructors.length,
            activeInstructors: activeTutors.length,
            totalStudents: db.students.length,
            activeStudents: activeStudents.length,
            submitted,
            pending: Math.max(0, expected - submitted),
            expected,
          },
          outstanding,
          recent,
        };
      },
    });
  },
};

/* ============================== BULK IMPORT ============================== */

const IMPORT_COLUMNS: Record<ImportKind, { header: string; key: string; required: boolean }[]> = {
  instructors: [
    { header: "Full name", key: "fullName", required: true },
    { header: "Email", key: "email", required: true },
    { header: "Phone", key: "phone", required: true },
    { header: "Subjects", key: "subjects", required: false },
  ],
  students: [
    { header: "Full name", key: "fullName", required: true },
    { header: "Grade", key: "grade", required: true },
    { header: "Gender", key: "gender", required: false },
    { header: "Parent name", key: "parentName", required: false },
    { header: "Parent phone", key: "parentPhone", required: false },
  ],
};

export const bulkImport = {
  columnsFor(kind: ImportKind): string[] {
    return IMPORT_COLUMNS[kind].map((column) => column.header);
  },

  /** Validates parsed rows without writing anything. */
  async preview(kind: ImportKind, rawRows: Record<string, string>[]): Promise<ImportPreview> {
    return request<ImportPreview>("/import/preview", {
      method: "POST",
      body: { kind, rows: rawRows },
      mutate: (db) => buildPreview(db, kind, rawRows),
    });
  },

  /** Writes only the rows that passed validation. */
  async commit(kind: ImportKind, rawRows: Record<string, string>[]): Promise<ImportResult> {
    return request<ImportResult>("/import/commit", {
      method: "POST",
      body: { kind, rows: rawRows },
      mutate: (db) => {
        const preview = buildPreview(db, kind, rawRows);
        let created = 0;
        let skipped = 0;

        preview.rows.forEach((row) => {
          if (row.errors.length) {
            skipped += 1;
            return;
          }
          if (kind === "instructors") {
            const values = row.values as Partial<Instructor>;
            db.instructors.push({
              id: makeId("tut"),
              fullName: values.fullName ?? "",
              email: values.email ?? "",
              phone: normalisePhone(values.phone ?? ""),
              token: tokenFor(values.fullName ?? "tutor"),
              subjects: values.subjects ?? [],
              status: "active",
              createdAt: new Date().toISOString(),
            });
          } else {
            const values = row.values as Partial<Student>;
            db.students.push({
              id: makeId("stu"),
              fullName: values.fullName ?? "",
              grade: values.grade ?? "",
              gender: values.gender ?? "Male",
              parentName: values.parentName ?? "",
              parentPhone: normalisePhone(values.parentPhone ?? ""),
              status: "active",
              createdAt: new Date().toISOString(),
            });
          }
          created += 1;
        });

        return { created, skipped, failed: skipped };
      },
    });
  },
};

function buildPreview(
  db: MockDatabase,
  kind: ImportKind,
  rawRows: Record<string, string>[],
): ImportPreview {
  const columns = IMPORT_COLUMNS[kind];
  const seenEmails = new Set<string>();
  const seenNames = new Set<string>();
  const rows: ImportRow[] = [];

  rawRows.forEach((raw, index) => {
    const errors: string[] = [];
    const values: Record<string, unknown> = {};

    columns.forEach((column) => {
      const value = (raw[column.header] ?? raw[column.key] ?? "").trim();
      if (column.required && !value) errors.push(`${column.header} is required`);
      values[column.key] = value;
    });

    if (kind === "instructors") {
      const email = String(values.email ?? "");
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Email looks invalid");
      if (email && db.instructors.some((tutor) => tutor.email.toLowerCase() === email.toLowerCase()))
        errors.push("Email already exists");
      if (email && seenEmails.has(email.toLowerCase())) errors.push("Duplicate row in file");
      if (email) seenEmails.add(email.toLowerCase());

      const subjects = String(values.subjects ?? "")
        .split(/[,|;]/)
        .map((subject) => subject.trim())
        .filter(Boolean);
      if (subjects.length === 0) errors.push("Add at least one subject");
      values.subjects = subjects;
    } else {
      const grade = String(values.grade ?? "");
      if (grade && !/^(Primary|JSS|SSS)\s?\d$/i.test(grade))
        errors.push("Grade must look like “JSS 2”");
      const gender = String(values.gender ?? "");
      if (gender && gender !== "Male" && gender !== "Female") errors.push("Gender must be Male or Female");
      values.gender = gender || "Male";

      const fullName = String(values.fullName ?? "");
      if (fullName && db.students.some((student) => student.fullName.toLowerCase() === fullName.toLowerCase()))
        errors.push("Student already exists");
      if (fullName && seenNames.has(fullName.toLowerCase())) errors.push("Duplicate row in file");
      if (fullName) seenNames.add(fullName.toLowerCase());
    }

    rows.push({ rowNumber: index + 1, raw, values: values as never, errors });
  });

  return {
    kind,
    rows,
    validCount: rows.filter((row) => row.errors.length === 0).length,
    errorCount: rows.filter((row) => row.errors.length > 0).length,
    duplicateCount: rows.filter((row) => row.errors.some((error) => /already exists|Duplicate/.test(error))).length,
  };
}

/* ============================== VALIDATION ============================== */

export interface DraftFieldErrors {
  topicsCovered?: string;
  continuityNote?: string;
  generalFeedback?: string;
  progressRating?: string;
  /** Lets these errors travel as `ApiError.fieldErrors` without a cast. */
  [field: string]: string | undefined;
}

/** Shared by the report form (live) and `portal.submit` (authoritative). */
export function validateDraft(draft: ReportDraftInput): DraftFieldErrors {
  const errors: DraftFieldErrors = {};

  if (draft.topicsCovered.trim().length < 10)
    errors.topicsCovered = "List the topics you covered (at least a short sentence).";
  if (draft.continuityNeeded && draft.continuityNote.trim().length < 10)
    errors.continuityNote = "Tell us what should continue next month.";
  if (draft.generalFeedback.trim().length < 20)
    errors.generalFeedback = "General feedback needs at least a sentence or two.";
  if (!draft.progressRating) errors.progressRating = "Choose a progress rating.";

  return errors;
}

function validateInstructor(values: InstructorFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (values.fullName.trim().length < 3) errors.fullName = "Enter the tutor's full name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "Enter a valid email address.";
  if (values.phone.replace(/\D/g, "").length < 10) errors.phone = "Enter a valid WhatsApp number.";
  if (values.subjects.length === 0) errors.subjects = "Select at least one subject.";
  return errors;
}

function validateStudent(values: StudentFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (values.fullName.trim().length < 3) errors.fullName = "Enter the student's full name.";
  if (!values.grade) errors.grade = "Select a grade.";
  if (values.parentPhone && values.parentPhone.replace(/\D/g, "").length < 10)
    errors.parentPhone = "Enter a valid WhatsApp number.";
  return errors;
}

function validateAssignment(values: AssignmentFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.instructorId) errors.instructorId = "Choose a tutor.";
  if (!values.studentId) errors.studentId = "Choose a student.";
  if (!values.subject) errors.subject = "Choose a subject.";
  return errors;
}

/* ============================== EXPORTS ================================== */

/* ============================ REPORT DOCUMENTS ============================ */

/**
 * TODO(backend): generate the branded PDF/Word files server-side.
 *
 * The UI already renders the exact printable layout (see
 * `components/admin/report-document.tsx`), so the backend can either
 * (a) reuse that markup via Playwright/ Puppeteer → PDF, or
 * (b) rebuild it with a docx/pdf library using the same data.
 */
export const documents = {
  async downloadPdf(reportId: string): Promise<{ url: string }> {
    return request<{ url: string }>(`/reports/${reportId}/pdf`, {
      mutate: () => {
        throw new ApiError(
          "NOT_FOUND",
          "PDF generation is not connected yet — use Print → Save as PDF for now.",
        );
      },
    });
  },

  async downloadWord(reportId: string): Promise<{ url: string }> {
    return request<{ url: string }>(`/reports/${reportId}/docx`, {
      mutate: () => {
        throw new ApiError(
          "NOT_FOUND",
          "Word export is not connected yet — this is where the backend drops the .docx URL.",
        );
      },
    });
  },
};

/* ------------------------------ Handy helpers ----------------------------- */

/** Avatar text for tables and cards. */
export { initials, firstName, pluralise };
export { getCurrentMonth };