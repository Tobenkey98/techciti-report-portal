import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.js";
import { generateTutorToken } from "../../../lib/crypto.js";
import { tutorLinkInvite, tutorPortalUrl, whatsappLink } from "../../../lib/whatsapp.js";
import { currentMonth } from "../../../lib/month.js";
import { AGE_GROUPS, LEVELS } from "../../../config/constants.js";
import { IMPORT_TEMPLATES, type ImportType } from "./import.parser.js";

export interface ImportRowResult {
  /** 1-based row number as it appears in the spreadsheet (header is row 1). */
  row: number;
  values: Record<string, string>;
  errors: Record<string, string>;
  status: "valid" | "error";
  /** What will happen if this row is committed. */
  action: "create" | "skip" | "update";
  message: string;
}

export interface ImportPreview {
  type: ImportType;
  totalRows: number;
  validCount: number;
  errorCount: number;
  /** Rows with no errors, i.e. what `dryRun=false` would write. */
  creatableCount: number;
  rows: ImportRowResult[];
  summary: Record<string, string>;
}

const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

/** Loose name comparison so "amaka obi" matches "Amaka Obi". */
const sameName = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/* -------------------------------------------------------------------------- */
/*                                  Tutors                                    */
/* -------------------------------------------------------------------------- */

async function validateTutors(rows: Record<string, string>[]) {
  const existing = await prisma.tutor.findMany({ select: { id: true, fullName: true, email: true } });
  const emailSeen = new Set<string>();

  return rows.map<ImportRowResult>((values, index) => {
    const errors: Record<string, string> = {};
    const fullName = values["Full name"] ?? "";
    const email = (values.Email ?? "").toLowerCase();
    const phone = values.Phone ?? "";

    if (!fullName) errors["Full name"] = "Full name is required.";
    if (!phone) errors.Phone = "Phone is required so we can send the tutor their portal link.";
    else if (phone.replace(/\D/g, "").length < 7) errors.Phone = "That phone number looks too short.";
    if (email && !isEmail(email)) errors.Email = "Enter a valid email address.";

    const duplicateName = existing.find((tutor) => sameName(tutor.fullName, fullName));
    const duplicateEmail = email ? existing.find((tutor) => tutor.email?.toLowerCase() === email) : undefined;
    const duplicateInFile = email ? emailSeen.has(email) : false;

    let action: ImportRowResult["action"] = "create";
    let message = "Will create a new tutor and generate their portal link.";

    if (duplicateName) {
      action = "skip";
      message = `${duplicateName.fullName} already exists — row will be skipped.`;
      if (duplicateEmail) message = `${duplicateName.fullName} already exists with this email — row will be skipped.`;
    } else if (duplicateEmail) {
      action = "skip";
      message = "That email belongs to an existing tutor — row will be skipped.";
    } else if (duplicateInFile) {
      action = "skip";
      message = "That email appears twice in this file — the second row will be skipped.";
    }

    if (email && !errors.Email) emailSeen.add(email);

    return {
      row: index + 2,
      values,
      errors,
      status: Object.keys(errors).length > 0 ? "error" : "valid",
      action,
      message,
    };
  });
}

async function commitTutors(results: ImportRowResult[], adminId: string) {
  const created: string[] = [];
  const skipped: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const result of results) {
      if (result.status === "error" || result.action === "skip") {
        skipped.push(result.values["Full name"] ?? `row ${result.row}`);
        continue;
      }

      const accessToken = generateTutorToken();
      const tutor = await tx.tutor.create({
        data: {
          fullName: result.values["Full name"]!,
          email: result.values.Email ? result.values.Email.toLowerCase() : null,
          phone: result.values.Phone!,
          accessToken,
        },
      });

      const url = tutorPortalUrl(tutor.accessToken);
      created.push(tutor.fullName);

      await tx.activityLog.create({
        data: {
          actorType: "ADMIN",
          actorId: adminId,
          action: "tutor.imported",
          entityType: "tutor",
          entityId: tutor.id,
          meta: { row: result.row, portalUrl: url },
        },
      });
    }
  });

  return { created, skipped };
}

/* -------------------------------------------------------------------------- */
/*                                 Students                                   */
/* -------------------------------------------------------------------------- */

async function validateStudents(rows: Record<string, string>[]) {
  const existing = await prisma.student.findMany({ select: { id: true, fullName: true } });

  return rows.map<ImportRowResult>((values, index) => {
    const errors: Record<string, string> = {};
    const fullName = values["Full name"] ?? "";
    const ageGroup = (values["Age group"] ?? "").toUpperCase();
    const parentEmail = (values["Parent email"] ?? "").toLowerCase();

    if (!fullName) errors["Full name"] = "Full name is required.";
    if (!ageGroup) errors["Age group"] = "Age group is required.";
    else if (!(AGE_GROUPS as readonly string[]).includes(ageGroup)) {
      errors["Age group"] = `Must be one of ${AGE_GROUPS.join(", ")}.`;
    }
    if (parentEmail && !isEmail(parentEmail)) errors["Parent email"] = "Enter a valid email address.";

    const duplicate = existing.find((student) => sameName(student.fullName, fullName));

    return {
      row: index + 2,
      values,
      errors,
      status: Object.keys(errors).length > 0 ? "error" : "valid",
      action: duplicate ? "skip" : "create",
      message: duplicate
        ? `${duplicate.fullName} already exists — row will be skipped.`
        : "Will create a new student.",
    };
  });
}

async function commitStudents(results: ImportRowResult[], adminId: string) {
  const created: string[] = [];
  const skipped: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const result of results) {
      if (result.status === "error" || result.action === "skip") {
        skipped.push(result.values["Full name"] ?? `row ${result.row}`);
        continue;
      }

      const student = await tx.student.create({
        data: {
          fullName: result.values["Full name"]!,
          ageGroup: result.values["Age group"]!.toUpperCase() as Prisma.StudentCreateInput["ageGroup"],
          parentName: result.values["Parent name"] || null,
          parentPhone: result.values["Parent phone"] || null,
          parentEmail: result.values["Parent email"] ? result.values["Parent email"].toLowerCase() : null,
        },
      });
      created.push(student.fullName);

      await tx.activityLog.create({
        data: {
          actorType: "ADMIN",
          actorId: adminId,
          action: "student.imported",
          entityType: "student",
          entityId: student.id,
          meta: { row: result.row },
        },
      });
    }
  });

  return { created, skipped };
}

/* -------------------------------------------------------------------------- */
/*                               Assignments                                  */
/* -------------------------------------------------------------------------- */

async function validateAssignments(rows: Record<string, string>[]) {
  const [tutors, students, courses, existing] = await Promise.all([
    prisma.tutor.findMany({ select: { id: true, fullName: true, isActive: true } }),
    prisma.student.findMany({ select: { id: true, fullName: true, isActive: true } }),
    prisma.course.findMany({ select: { id: true, name: true, isActive: true } }),
    prisma.assignment.findMany({ select: { tutorId: true, studentId: true, courseId: true } }),
  ]);

  const existingKeys = new Set(existing.map((row) => `${row.tutorId}|${row.studentId}|${row.courseId}`));

  return rows.map<ImportRowResult>((values, index) => {
    const errors: Record<string, string> = {};
    const tutorName = values.Tutor ?? "";
    const studentName = values.Student ?? "";
    const courseName = values.Course ?? "";
    const level = (values.Level ?? "").toUpperCase();

    const tutor = tutors.find((row) => sameName(row.fullName, tutorName));
    const student = students.find((row) => sameName(row.fullName, studentName));
    const course = courses.find((row) => sameName(row.name, courseName));

    if (!tutorName) errors.Tutor = "Tutor is required.";
    else if (!tutor) errors.Tutor = `No tutor named "${tutorName}" exists.`;
    else if (!tutor.isActive) errors.Tutor = "That tutor is deactivated.";

    if (!studentName) errors.Student = "Student is required.";
    else if (!student) errors.Student = `No student named "${studentName}" exists.`;
    else if (!student.isActive) errors.Student = "That student is deactivated.";

    if (!courseName) errors.Course = "Course is required.";
    else if (!course) errors.Course = `No course named "${courseName}" exists.`;
    else if (!course.isActive) errors.Course = "That course is deactivated.";

    if (!level) errors.Level = "Level is required.";
    else if (!(LEVELS as readonly string[]).includes(level)) {
      errors.Level = `Must be one of ${LEVELS.join(", ")}.`;
    }

    let action: ImportRowResult["action"] = "create";
    let message = "Will create a new assignment.";

    if (tutor && student && course) {
      if (existingKeys.has(`${tutor.id}|${student.id}|${course.id}`)) {
        action = "skip";
        message = "That tutor already teaches that course to that student — row will be skipped.";
      }
    }

    return {
      row: index + 2,
      values,
      errors,
      status: Object.keys(errors).length > 0 ? "error" : "valid",
      action,
      message,
    };
  });
}

async function commitAssignments(results: ImportRowResult[], adminId: string) {
  const created: string[] = [];
  const skipped: string[] = [];

  await prisma.$transaction(async (tx) => {
    const [tutors, students, courses] = await Promise.all([
      tx.tutor.findMany({ select: { id: true, fullName: true } }),
      tx.student.findMany({ select: { id: true, fullName: true } }),
      tx.course.findMany({ select: { id: true, name: true } }),
    ]);

    for (const result of results) {
      if (result.status === "error" || result.action === "skip") {
        skipped.push(`row ${result.row}`);
        continue;
      }

      const tutor = tutors.find((row) => sameName(row.fullName, result.values.Tutor!));
      const student = students.find((row) => sameName(row.fullName, result.values.Student!));
      const course = courses.find((row) => sameName(row.name, result.values.Course!));
      if (!tutor || !student || !course) {
        skipped.push(`row ${result.row}`);
        continue;
      }

      const assignment = await tx.assignment.create({
        data: {
          tutorId: tutor.id,
          studentId: student.id,
          courseId: course.id,
          level: result.values.Level!.toUpperCase() as Prisma.AssignmentUncheckedCreateInput["level"],
        },
      });
      created.push(`${tutor.fullName} → ${student.fullName} (${course.name})`);

      await tx.activityLog.create({
        data: {
          actorType: "ADMIN",
          actorId: adminId,
          action: "assignment.imported",
          entityType: "assignment",
          entityId: assignment.id,
          meta: { row: result.row },
        },
      });
    }
  });

  return { created, skipped };
}

/* -------------------------------------------------------------------------- */
/*                                   Entry                                    */
/* -------------------------------------------------------------------------- */

/** Validates every row and returns the preview — never writes anything. */
export async function previewImport(type: ImportType, rows: Record<string, string>[]): Promise<ImportPreview> {
  const results =
    type === "tutors"
      ? await validateTutors(rows)
      : type === "students"
        ? await validateStudents(rows)
        : await validateAssignments(rows);

  const errorCount = results.filter((result) => result.status === "error").length;
  const creatableCount = results.filter(
    (result) => result.status === "valid" && result.action === "create",
  ).length;

  return {
    type,
    totalRows: results.length,
    validCount: results.length - errorCount,
    errorCount,
    creatableCount,
    rows: results,
    summary: {
      willCreate: String(creatableCount),
      willSkip: String(results.length - errorCount - creatableCount),
      hasErrors: String(errorCount > 0),
      columns: IMPORT_TEMPLATES[type].columns.map((column) => column.key).join(", "),
    },
  };
}

/** Re-validates and commits in a single transaction so a failure rolls back everything. */
export async function commitImport(
  type: ImportType,
  rows: Record<string, string>[],
  adminId: string,
): Promise<{ preview: ImportPreview; created: string[]; skipped: string[] }> {
  const preview = await previewImport(type, rows);

  const committable = preview.rows.filter((row) => row.status === "valid" && row.action === "create");
  if (committable.length === 0) {
    return { preview, created: [], skipped: preview.rows.map((row) => `row ${row.row}`) };
  }

  const outcome =
    type === "tutors"
      ? await commitTutors(committable, adminId)
      : type === "students"
        ? await commitStudents(committable, adminId)
        : await commitAssignments(committable, adminId);

  return { preview, ...outcome };
}

/**
 * After importing tutors, an admin usually wants to share the links straight
 * away. Returns a ready-made WhatsApp message per freshly created tutor.
 */
export function shareMessagesFor(tutors: { fullName: string; phone: string }[]): {
  fullName: string;
  message: string;
  whatsappLink: string | null;
}[] {
  return tutors.map((tutor) => {
    const message = `Hi ${tutor.fullName}, your TechCiti tutor portal is ready. Open your link to submit monthly reports: `;
    return { fullName: tutor.fullName, message, whatsappLink: whatsappLink(tutor.phone, message) };
  });
}

export { currentMonth, tutorLinkInvite };