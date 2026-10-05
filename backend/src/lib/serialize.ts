import type {
  ActivityLog,
  Admin,
  Assignment,
  Course,
  Tutor,
  Report,
  Student,
} from "@prisma/client";
import { formatDateTime } from "./month.js";

/* -------------------------------------------------------------------------- */
/*                                  Primitives                                */
/* -------------------------------------------------------------------------- */

export interface AdminView {
  id: string;
  name: string;
  email: string;
  role: Admin["role"];
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface TutorView {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  isActive: boolean;
  tokenRevokedAt: string | null;
  createdAt: string;
  /** Only present for the tutor's own token — never exposed to other admins' lists. */
  accessToken?: string;
}

export interface StudentView {
  id: string;
  fullName: string;
  ageGroup: Student["ageGroup"];
  parentName: string | null;
  parentPhone: string | null;
  parentEmail: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CourseView {
  id: string;
  name: string;
  category: string;
  isActive: boolean;
  createdAt: string;
}

export interface AssignmentView {
  id: string;
  tutorId: string;
  studentId: string;
  courseId: string;
  level: Assignment["level"];
  isActive: boolean;
  createdAt: string;
}

export interface AssignmentWithRefs extends AssignmentView {
  tutor: Pick<TutorView, "id" | "fullName" | "email" | "phone">;
  student: Pick<StudentView, "id" | "fullName" | "ageGroup" | "parentName" | "parentPhone">;
  course: Pick<CourseView, "id" | "name" | "category">;
}

export interface ReportView {
  id: string;
  assignmentId: string;
  month: string;
  topicsCovered: string;
  continuityNeeded: boolean;
  continuityNote: string | null;
  generalFeedback: string;
  tutorComment: string;
  progressRating: Report["progressRating"];
  sessionsHeld: number | null;
  sessionsAttended: number | null;
  status: Report["status"];
  revisionNote: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportWithContext extends ReportView {
  tutor: { id: string; fullName: string; email: string | null; phone: string };
  student: {
    id: string;
    fullName: string;
    ageGroup: Student["ageGroup"];
    parentName: string | null;
    parentPhone: string | null;
    parentEmail: string | null;
  };
  course: { id: string; name: string; category: string };
  level: Assignment["level"];
  reviewedBy: { id: string; name: string } | null;
}

export interface ActivityLogView {
  id: string;
  actorType: ActivityLog["actorType"];
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  meta: unknown;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/*                                  Mappers                                   */
/* -------------------------------------------------------------------------- */

export const toAdminView = (admin: Admin): AdminView => ({
  id: admin.id,
  name: admin.name,
  email: admin.email,
  role: admin.role,
  isActive: admin.isActive,
  lastLoginAt: formatDateTime(admin.lastLoginAt),
  createdAt: formatDateTime(admin.createdAt) ?? "",
});

/** `includeToken` is only ever true for the row the admin just created or asked to rotate. */
export const toTutorView = (tutor: Tutor, includeToken = false): TutorView => ({
  id: tutor.id,
  fullName: tutor.fullName,
  email: tutor.email,
  phone: tutor.phone,
  isActive: tutor.isActive,
  tokenRevokedAt: formatDateTime(tutor.tokenRevokedAt),
  createdAt: formatDateTime(tutor.createdAt) ?? "",
  ...(includeToken ? { accessToken: tutor.accessToken } : {}),
});

/** Compact shape for the tutor's own `/me` endpoint — no token echoed back. */
export const toTutorSelfView = (tutor: Pick<Tutor, "id" | "fullName" | "email" | "isActive">) => ({
  id: tutor.id,
  fullName: tutor.fullName,
  email: tutor.email,
  isActive: tutor.isActive,
});

export const toStudentView = (student: Student): StudentView => ({
  id: student.id,
  fullName: student.fullName,
  ageGroup: student.ageGroup,
  parentName: student.parentName,
  parentPhone: student.parentPhone,
  parentEmail: student.parentEmail,
  isActive: student.isActive,
  createdAt: formatDateTime(student.createdAt) ?? "",
});

export const toCourseView = (course: Course): CourseView => ({
  id: course.id,
  name: course.name,
  category: course.category,
  isActive: course.isActive,
  createdAt: formatDateTime(course.createdAt) ?? "",
});

type AssignmentRecord = Assignment & {
  tutor?: Pick<Tutor, "id" | "fullName" | "email" | "phone">;
  student?: Pick<Student, "id" | "fullName" | "ageGroup" | "parentName" | "parentPhone">;
  course?: Pick<Course, "id" | "name" | "category">;
};

export const toAssignmentView = (assignment: Assignment): AssignmentView => ({
  id: assignment.id,
  tutorId: assignment.tutorId,
  studentId: assignment.studentId,
  courseId: assignment.courseId,
  level: assignment.level,
  isActive: assignment.isActive,
  createdAt: formatDateTime(assignment.createdAt) ?? "",
});

export function toAssignmentWithRefs(assignment: AssignmentRecord): AssignmentWithRefs {
  return {
    ...toAssignmentView(assignment),
    tutor: {
      id: assignment.tutor?.id ?? assignment.tutorId,
      fullName: assignment.tutor?.fullName ?? "Deactivated tutor",
      email: assignment.tutor?.email ?? null,
      phone: assignment.tutor?.phone ?? "",
    },
    student: {
      id: assignment.student?.id ?? assignment.studentId,
      fullName: assignment.student?.fullName ?? "Deactivated student",
      ageGroup: assignment.student?.ageGroup ?? "ADULTS",
      parentName: assignment.student?.parentName ?? null,
      parentPhone: assignment.student?.parentPhone ?? null,
    },
    course: {
      id: assignment.course?.id ?? assignment.courseId,
      name: assignment.course?.name ?? "Unknown course",
      category: assignment.course?.category ?? "General",
    },
  };
}

export const toReportView = (report: Report): ReportView => ({
  id: report.id,
  assignmentId: report.assignmentId,
  month: report.month,
  topicsCovered: report.topicsCovered,
  continuityNeeded: report.continuityNeeded,
  continuityNote: report.continuityNote,
  generalFeedback: report.generalFeedback,
  tutorComment: report.tutorComment,
  progressRating: report.progressRating,
  sessionsHeld: report.sessionsHeld,
  sessionsAttended: report.sessionsAttended,
  status: report.status,
  revisionNote: report.revisionNote,
  submittedAt: formatDateTime(report.submittedAt),
  reviewedAt: formatDateTime(report.reviewedAt),
  createdAt: formatDateTime(report.createdAt) ?? "",
  updatedAt: formatDateTime(report.updatedAt) ?? "",
});

type ReportRecord = Report & {
  assignment?: {
    level: Assignment["level"];
    tutorId?: string;
    studentId?: string;
    courseId?: string;
    tutor?: Pick<Tutor, "id" | "fullName" | "email" | "phone">;
    student?: Pick<
      Student,
      "id" | "fullName" | "ageGroup" | "parentName" | "parentPhone" | "parentEmail"
    >;
    course?: Pick<Course, "id" | "name" | "category">;
  };
  reviewedByAdmin?: Pick<Admin, "id" | "name"> | null;
};

export function toReportWithContext(report: ReportRecord): ReportWithContext {
  const assignment = report.assignment;
  return {
    ...toReportView(report),
    tutor: {
      id: assignment?.tutor?.id ?? assignment?.tutorId ?? "",
      fullName: assignment?.tutor?.fullName ?? "Unknown tutor",
      email: assignment?.tutor?.email ?? null,
      phone: assignment?.tutor?.phone ?? "",
    },
    student: {
      id: assignment?.student?.id ?? assignment?.studentId ?? "",
      fullName: assignment?.student?.fullName ?? "Unknown student",
      ageGroup: assignment?.student?.ageGroup ?? "ADULTS",
      parentName: assignment?.student?.parentName ?? null,
      parentPhone: assignment?.student?.parentPhone ?? null,
      parentEmail: assignment?.student?.parentEmail ?? null,
    },
    course: {
      id: assignment?.course?.id ?? assignment?.courseId ?? "",
      name: assignment?.course?.name ?? "Unknown course",
      category: assignment?.course?.category ?? "General",
    },
    level: assignment?.level ?? "BEGINNER",
    reviewedBy: report.reviewedByAdmin
      ? { id: report.reviewedByAdmin.id, name: report.reviewedByAdmin.name }
      : null,
  };
}

export const toActivityLogView = (log: ActivityLog): ActivityLogView => ({
  id: log.id,
  actorType: log.actorType,
  actorId: log.actorId,
  action: log.action,
  entityType: log.entityType,
  entityId: log.entityId,
  meta: log.meta,
  createdAt: formatDateTime(log.createdAt) ?? "",
});