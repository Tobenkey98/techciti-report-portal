/* ------------------------------------------------------------------ *
 * TEST-ROW JANITOR
 *
 * `scripts/smoke.mjs` and `../../scripts/contract-check.mjs` both create
 * throwaway tutors, students and assignments on every run, named with a
 * recognisable prefix so they can be found again.
 *
 * The API deliberately refuses to hard-delete a tutor or student that owns
 * any report, and deleting an assignment only deactivates it while keeping its
 * reports. That is the right product behaviour, but it means neither test can
 * fully tidy up after itself through the HTTP surface alone — so this script
 * clears those rows at the database level instead.
 *
 * It only ever touches rows whose names start with the prefixes below, which
 * no seeded or real record does.
 *
 *   node scripts/purge-test-rows.mjs            # report only
 *   node scripts/purge-test-rows.mjs --quiet    # no output
 * ------------------------------------------------------------------ */

import { PrismaClient } from "@prisma/client";

/** Names every test suite uses as its throwaway prefix. */
const PREFIXES = [
  "Smoke Test",
  "Contract Check",
  "Contract Student",
  "Imported Tutor",
  "Contract Check Student",
];

const quiet = process.argv.includes("--quiet");

/** Prisma's `startsWith` takes one string, so the alternatives are OR'd. */
const nameMatches = PREFIXES.map((prefix) => ({ fullName: { startsWith: prefix } }));

const prisma = new PrismaClient();

try {
  const tutorIds = (
    await prisma.tutor.findMany({ where: { OR: nameMatches }, select: { id: true } })
  ).map((row) => row.id);
  const studentIds = (
    await prisma.student.findMany({ where: { OR: nameMatches }, select: { id: true } })
  ).map((row) => row.id);

  const assignmentWhere = {
    OR: [
      ...(tutorIds.length ? [{ tutorId: { in: tutorIds } }] : []),
      ...(studentIds.length ? [{ studentId: { in: studentIds } }] : []),
    ],
  };

  const assignmentIds = (
    await prisma.assignment.findMany({ where: assignmentWhere, select: { id: true } })
  ).map((row) => row.id);

  // Child rows first, or the foreign keys refuse the parent deletes.
  const activity = await prisma.activityLog.deleteMany({
    where: {
      OR: [
        ...(tutorIds.length ? [{ entityId: { in: tutorIds } }] : []),
        ...(studentIds.length ? [{ entityId: { in: studentIds } }] : []),
        ...(assignmentIds.length ? [{ entityId: { in: assignmentIds } }] : []),
      ],
    },
  });
  const reports = await prisma.report.deleteMany({
    where: { assignmentId: { in: assignmentIds } },
  });
  const assignments = await prisma.assignment.deleteMany({ where: assignmentWhere });
  const tutors = await prisma.tutor.deleteMany({ where: { OR: nameMatches } });
  const students = await prisma.student.deleteMany({ where: { OR: nameMatches } });

  if (!quiet) {
    console.log("purged test rows:", {
      activityLogs: activity.count,
      reports: reports.count,
      assignments: assignments.count,
      tutors: tutors.count,
      students: students.count,
    });
    console.log("database now holds:", {
      tutors: await prisma.tutor.count(),
      students: await prisma.student.count(),
      courses: await prisma.course.count(),
      assignments: await prisma.assignment.count(),
      reports: await prisma.report.count(),
    });
  }
} finally {
  await prisma.$disconnect();
}