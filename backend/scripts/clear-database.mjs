/* ------------------------------------------------------------------ *
 * CLEAR DATABASE (fresh start)
 *
 * Deletes every tutor, student, assignment, report and activity-log row so
 * the admin starts from an empty dashboard and adds tutors/students
 * through the UI.
 *
 * Kept on purpose:
 *   - admins   (otherwise nobody could log in again)
 *   - courses  (the catalogue assignments depend on; there is no UI to
 *               recreate courses, and deleting them would break the
 *               assignment form)
 *
 *   node scripts/clear-database.mjs            # shows what was removed
 *   node scripts/clear-database.mjs --quiet   # no output
 * ------------------------------------------------------------------ */

import { PrismaClient } from "@prisma/client";

const quiet = process.argv.includes("--quiet");
const prisma = new PrismaClient();

try {
  // Children first so foreign keys never complain, even if the schema's
  // cascades change one day.
  const reports = await prisma.report.deleteMany({});
  const assignments = await prisma.assignment.deleteMany({});
  const students = await prisma.student.deleteMany({});
  const tutors = await prisma.tutor.deleteMany({});
  const activityLogs = await prisma.activityLog.deleteMany({});

  const remaining = {
    admins: await prisma.admin.count(),
    courses: await prisma.course.count(),
    tutors: await prisma.tutor.count(),
    students: await prisma.student.count(),
    assignments: await prisma.assignment.count(),
    reports: await prisma.report.count(),
  };

  if (!quiet) {
    console.log("removed:", {
      reports: reports.count,
      assignments: assignments.count,
      students: students.count,
      tutors: tutors.count,
      activityLogs: activityLogs.count,
    });
    console.log("database now holds:", remaining);
  }
} finally {
  await prisma.$disconnect();
}
