/**
 * Seeds a realistic demo dataset.
 *
 *   npm run seed          # creates anything missing, leaves existing rows alone
 *   npm run seed -- --reset   # wipes demo data first, then reseeds
 *
 * Everything is deterministic (seeded PRNG, fixed dates) so screenshots,
 * demos and manual QA always look the same.
 */
import { Prisma, PrismaClient, type Level, type ProgressRating, type ReportStatus, type AgeGroup } from "@prisma/client";
import { hashPassword, generateTutorToken } from "../src/lib/crypto.js";

const prisma = new PrismaClient();

/* -------------------------------------------------------------------------- */
/*                          Deterministic pseudo-random                        */
/* -------------------------------------------------------------------------- */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261004);
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]!;
const between = (min: number, max: number): number => Math.floor(rand() * (max - min + 1)) + min;

/**
 * A stable pseudo-random number in [0, 1) derived only from its arguments.
 *
 * The seed's *structure* — which tutor gets which students, on which course, at
 * which level — is decided with this instead of with `rand`, and that matters
 * for more than tidiness.
 *
 * `rand` is a single shared stream, so how far it has advanced depends on how
 * many times it was called. Structural choices must not depend on that, because
 * the call count differs between a fresh database and a partly populated one:
 * a partly populated database takes fewer `pick(LEVELS)` branches (the row
 * already exists), which shifts the stream and changes every later pairings.
 * The drift then compounds — each new assignment creates another report — so a
 * re-run invents rows instead of confirming them.
 *
 * Hashing the ids keeps the board a pure function of the input, so the seed is
 * genuinely idempotent and a reset always reproduces the same demo data.
 */
function hashUnit(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    const text = String(part);
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= 0x2f; // separator, so ["ab", "c"] and ["a", "bc"] hash differently
  }
  return (h >>> 0) / 4294967296;
}

const RESET = process.argv.includes("--reset");

/** Current month, so the seed always produces a live-looking current period. */
const CURRENT_MONTH = (() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
})();

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number) as [number, number];
  const date = new Date(year, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/* -------------------------------------------------------------------------- */
/*                                   Data                                     */
/* -------------------------------------------------------------------------- */

const COURSES: { name: string; category: string }[] = [
  { name: "Web Development Fundamentals", category: "Web" },
  { name: "Python Programming", category: "Programming" },
  { name: "Scratch Game Development", category: "Kids Coding" },
  { name: "Robotics & Embedded Systems", category: "Robotics" },
  { name: "UI/UX Design Essentials", category: "Design" },
  { name: "Graphic Design with Canva", category: "Design" },
  { name: "Data Analysis with Excel", category: "Data" },
  { name: "Mobile App Development", category: "Programming" },
  { name: "JavaScript Interactivity", category: "Web" },
  { name: "Intro to Coding (Ages 8–11)", category: "Kids Coding" },
];

const TUTORS: { fullName: string; email: string; phone: string }[] = [
  { fullName: "Amaka Obi", email: "amaka.obi@techciti.ng", phone: "+2348012345678" },
  { fullName: "Ibrahim Yusuf", email: "ibrahim.yusuf@techciti.ng", phone: "+2348023456789" },
  { fullName: "Chioma Eze", email: "chioma.eze@techciti.ng", phone: "+2348034567890" },
  { fullName: "Segun Adeyemi", email: "segun.adeyemi@techciti.ng", phone: "+2348045678901" },
  { fullName: "Fatima Bello", email: "fatima.bello@techciti.ng", phone: "+2348056789012" },
];

const KID_NAMES = [
  "Zainab Balogun", "David Chukwu", "Aisha Mohammed", "Emeka Nwosu", "Blessing Okeke",
  "Yusuf Abdullahi", "Grace Udo", "Kelechi Obi", "Maryam Lawal", "Tunde Ajayi",
];
const TEEN_NAMES = [
  "Oluwaseun Akinola", "Ngozi Iheanacho", "Ibrahim Sanni", "Chinaza Okafor", "Hauwa Danjuma",
  "Segun Alabi", "Adaora Nnamdi", "Suleiman Yakubu", "Rita Mbeki", "Femi Adesina",
];
const ADULT_NAMES = [
  "Ngozi Okonkwo", "Kelechi Nnamdi", "Bisi Afolabi", "Tunde Bakare", "Amina Yusuf",
  "Chika Obi", "Olumide Fashola", "Rukayat Sowande", "Emeka Uzoma", "Fatima Bello",
];

const PARENT_NAMES = [
  "Mrs Fatima Balogun", "Mr David Chukwu", "Mrs Aisha Mohammed", "Mr Chinedu Nwosu",
  "Mrs Blessing Okeke", "Alhaji Yusuf Abdullahi", "Mrs Grace Udo", "Mr Kelechi Obi",
  "Mrs Maryam Lawal", "Mr Tunde Ajayi",
];

function phone(seedIndex: number): string {
  return `+23480${String(seedIndex).padStart(8, "0").slice(0, 8)}`;
}

function buildStudents() {
  const students: { fullName: string; ageGroup: AgeGroup; parentName: string; parentPhone: string; parentEmail: string }[] = [];

  KID_NAMES.slice(0, 7).forEach((fullName, index) => {
    students.push({
      fullName,
      ageGroup: "KIDS",
      parentName: PARENT_NAMES[index % PARENT_NAMES.length]!,
      parentPhone: phone(1000 + index),
      parentEmail: `parent${index + 1}@example.com`,
    });
  });

  TEEN_NAMES.slice(0, 7).forEach((fullName, index) => {
    students.push({
      fullName,
      ageGroup: "TEENS",
      parentName: PARENT_NAMES[index % PARENT_NAMES.length]!,
      parentPhone: phone(2000 + index),
      parentEmail: `guardian${index + 1}@example.com`,
    });
  });

  ADULT_NAMES.slice(0, 6).forEach((fullName, index) => {
    students.push({
      fullName,
      ageGroup: "ADULTS",
      // Adult learners are their own point of contact.
      parentName: "",
      parentPhone: phone(3000 + index),
      parentEmail: `${fullName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    });
  });

  return students;
}

const TOPIC_POOL: Record<string, string[]> = {
  "Web Development Fundamentals": ["HTML structure & semantics", "CSS box model", "Responsive layout with Flexbox", "Git basics"],
  "Python Programming": ["Variables & data types", "Loops and conditionals", "Functions & modules", "File handling"],
  "Scratch Game Development": ["Sprites & backdrops", "Event-driven scripting", "Collision detection", "Scoring system"],
  "Robotics & Embedded Systems": ["Microcontroller basics", "Sensor reading", "Motor control", "Line-following algorithm"],
  "UI/UX Design Essentials": ["Wireframing", "Design systems & components", "Usability heuristics", "Prototyping in Figma"],
  "Graphic Design with Canva": ["Colour theory", "Typography pairing", "Brand marks", "Social media layouts"],
  "Data Analysis with Excel": ["Spreadsheet hygiene", "Pivot tables", "Charts that persuade", "Cleaning survey data"],
  "Mobile App Development": ["App structure", "Navigation patterns", "Storing local data", "Publishing to the store"],
  "JavaScript Interactivity": ["DOM selection", "Event listeners", "Fetch and render", "Form validation"],
  "Intro to Coding (Ages 8–11)": ["Reading code like a recipe", "Loops with repeat blocks", "Simple games", "Debugging by guessing"],
};

const FEEDBACK_POOL = [
  "Consistently attentive and eager to try each exercise before help is offered.",
  "Understands the fundamentals well and is ready for the next module.",
  "Needs a little more repetition on loops, but confidence is clearly growing.",
  "Excellent focus this month and finished every session's exercises.",
  "Improved a great deal since last month; now asks clarifying questions first.",
  "Works best in small groups, so pair with a peer mentor for support.",
];

const TUTOR_COMMENTS = [
  "Great month overall — keep the same pace.",
  "Would benefit from a short catch-up session before the next module.",
  "A natural fit for the advanced track next term.",
  "Very engaged; consider a small project to stretch further.",
  "Steady progress. Continue with the same weekly cadence.",
];

const CONTINUITY_NOTES = [
  "Needs two remedial sessions on conditional logic.",
  "Should continue building on the recursion topic next month.",
  "Requires more practice with reading multi-step instructions.",
  "Would benefit from a refresher on debugging strategies.",
];

const LEVELS: Level[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const RATINGS: ProgressRating[] = ["EXCELLENT", "GOOD", "FAIR", "NEEDS_ATTENTION"];

/* -------------------------------------------------------------------------- */
/*                                   Seed                                     */
/* -------------------------------------------------------------------------- */

async function reset() {
  console.log("• Clearing existing data…");
  // Order matters: children first.
  await prisma.activityLog.deleteMany();
  await prisma.report.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.student.deleteMany();
  await prisma.tutor.deleteMany();
  await prisma.course.deleteMany();
  await prisma.admin.deleteMany();
}

/**
 * Creates the super admin from the .env credentials if no admin with that email
 * exists yet.
 */
async function seedAdmin() {
  const email = (process.env.SUPER_ADMIN_EMAIL ?? "admin@techciti.ng").toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD ?? "TechCiti2026!";
  const name = process.env.SUPER_ADMIN_NAME ?? "TechCiti Super Admin";

  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) {
    console.log(`• Super admin already present (${email})`);
    return existing;
  }

  const admin = await prisma.admin.create({
    data: { name, email, role: "SUPER_ADMIN", passwordHash: await hashPassword(password) },
  });
  console.log(`• Super admin created: ${email}`);
  return admin;
}

async function seedCourses() {
  const created = [];
  for (const course of COURSES) {
    const row = await prisma.course.upsert({
      where: { name: course.name },
      create: course,
      update: { category: course.category },
    });
    created.push(row);
  }
  console.log(`• ${created.length} courses ready`);
  return created;
}

async function seedTutors() {
  const created = [];
  for (const tutor of TUTORS) {
    const existing = await prisma.tutor.findUnique({ where: { email: tutor.email } });
    if (existing) {
      created.push(existing);
      continue;
    }
    created.push(
      await prisma.tutor.create({
        data: { ...tutor, accessToken: generateTutorToken() },
      }),
    );
  }
  console.log(`• ${created.length} tutors ready`);
  return created;
}

async function seedStudents() {
  const created = [];
  for (const student of buildStudents()) {
    const existing = await prisma.student.findFirst({ where: { fullName: student.fullName } });
    if (existing) {
      created.push(existing);
      continue;
    }
    created.push(
      await prisma.student.create({
        data: {
          fullName: student.fullName,
          ageGroup: student.ageGroup,
          parentName: student.parentName || null,
          parentPhone: student.parentPhone || null,
          parentEmail: student.parentEmail || null,
        },
      }),
    );
  }
  console.log(`• ${created.length} students ready`);
  return created;
}

/**
 * Builds a believable assignment board: every tutor gets 5–8 students, each
 * student may appear with more than one tutor and more than one course.
 */
async function seedAssignments(tutors: Awaited<ReturnType<typeof seedTutors>>, students: Awaited<ReturnType<typeof seedStudents>>, courses: Awaited<ReturnType<typeof seedCourses>>) {
  const created: { id: string; tutorId: string; studentId: string; courseId: string; level: Level }[] = [];

  for (const tutor of tutors) {
    const target = 5 + Math.floor(hashUnit("target", tutor.id) * 4);
    // A consistent comparator (a pure function of each element, with no side
    // effects) so the order is reproducible; `rand() - 0.5` would not be.
    const shuffled = [...students]
      .sort((a, b) => hashUnit("shuffle", tutor.id, a.id) - hashUnit("shuffle", tutor.id, b.id))
      .slice(0, target);

    for (const student of shuffled) {
      // Kids get kids-appropriate courses; adults may take two courses.
      const pool =
        student.ageGroup === "KIDS"
          ? courses.filter((course) => course.category === "Kids Coding" || course.category === "Robotics")
          : courses;
      const choices = pool.length > 0 ? pool : courses;
      const course = choices[Math.floor(hashUnit("course", tutor.id, student.id) * choices.length)]!;

      const existing = await prisma.assignment.findUnique({
        where: {
          assignment_tutor_student_course: {
            tutorId: tutor.id,
            studentId: student.id,
            courseId: course.id,
          },
        },
      });
      if (existing) {
        created.push(existing as (typeof created)[number]);
        continue;
      }

      created.push(
        await prisma.assignment.create({
          data: {
            tutorId: tutor.id,
            studentId: student.id,
            courseId: course.id,
            level: LEVELS[Math.floor(hashUnit("level", tutor.id, student.id, course.id) * LEVELS.length)]!,
          },
        }),
      );
    }
  }

  console.log(`• ${created.length} assignments ready`);
  return created;
}

function isoAt(month: string, dayOfMonth: number, hour: number): string {
  const [year, m] = month.split("-").map(Number) as [number, number];
  // Never spill into the following month when dayOfMonth is too large.
  const lastDay = new Date(year, m, 0).getDate();
  const day = Math.min(Math.max(1, dayOfMonth), lastDay);
  const date = new Date(year, m - 1, day, hour, between(0, 59), 0);
  return date.toISOString();
}

/**
 * Fills the last three months of reports so the admin app has data in every
 * status, and the current month has a realistic mix of progress.
 */
async function seedReports(assignments: Awaited<ReturnType<typeof seedAssignments>>, adminId: string) {
  const months = [shiftMonth(CURRENT_MONTH, -2), shiftMonth(CURRENT_MONTH, -1), CURRENT_MONTH];

  const courses = await prisma.course.findMany({ select: { id: true, name: true } });
  const courseNameById = new Map(courses.map((course) => [course.id, course.name]));

  const rows: Prisma.ReportCreateManyInput[] = [];

  for (const assignment of assignments) {
    const courseName = courseNameById.get(assignment.courseId) ?? "Course";
    const topics = TOPIC_POOL[courseName] ?? TOPIC_POOL["Python Programming"]!;

    months.forEach((month, monthIndex) => {
      const isCurrent = month === CURRENT_MONTH;

      // Current month gets a believable spread of unfinished work; past months
      // are mostly finished so the history looks real.
      const status: ReportStatus = isCurrent
        ? pick<ReportStatus>([
            "SUBMITTED", "SUBMITTED", "SUBMITTED", "REVIEWED", "REVIEWED",
            "DRAFT", "DRAFT", "NEEDS_REVISION",
          ])
        : monthIndex === 0
          ? pick<ReportStatus>(["SUBMITTED", "SUBMITTED", "REVIEWED", "REVIEWED", "NEEDS_REVISION"])
          : pick<ReportStatus>(["SUBMITTED", "REVIEWED", "REVIEWED"]);

      const continuityNeeded = rand() < 0.35;
      const sessionsHeld = between(2, 8);
      const isDraft = status === "DRAFT";
      const submittedAt = isDraft ? null : new Date(isoAt(month, between(2, 25), between(9, 17)));
      const isReviewed = status === "REVIEWED";

      rows.push({
        assignmentId: assignment.id,
        month,
        topicsCovered: topics
          .slice(0, between(2, 4))
          .map((topic, n) => `${n + 1}. ${topic}`)
          .join("\n"),
        continuityNeeded,
        continuityNote: continuityNeeded ? pick(CONTINUITY_NOTES) : null,
        generalFeedback: pick(FEEDBACK_POOL)!,
        tutorComment: pick(TUTOR_COMMENTS)!,
        progressRating: isDraft ? null : pick(RATINGS),
        sessionsHeld,
        sessionsAttended: between(1, sessionsHeld),
        status,
        revisionNote:
          status === "NEEDS_REVISION"
            ? "Please add an example from the last session and make the feedback more specific."
            : null,
        submittedAt,
        reviewedAt: isReviewed && submittedAt ? new Date(submittedAt.getTime() + 1000 * 60 * 60 * 24 * 2) : null,
        reviewedByAdminId: isReviewed ? adminId : null,
      });
    });
  }

  // `skipDuplicates` makes the seed safe to re-run: the unique index on
  // (assignmentId, month) means existing reports are left untouched.
  const inserted = await prisma.report.createMany({ data: rows, skipDuplicates: true });

  const total = await prisma.report.count();
  const byStatus = await prisma.report.groupBy({ by: ["status"], _count: { _all: true } });
  const summary = byStatus.map((row) => `${row.status}=${row._count._all}`).join(" ");
  console.log(`• ${inserted.count} reports created (${total} total: ${summary})`);
}

async function main() {
  console.log("\nTechCiti — seeding database\n");

  if (RESET) await reset();

  const admin = await seedAdmin();
  const courses = await seedCourses();
  const tutors = await seedTutors();
  const students = await seedStudents();
  const assignments = await seedAssignments(tutors, students, courses);
  await seedReports(assignments, admin.id);

  await prisma.activityLog.create({
    data: {
      actorType: "SYSTEM",
      actorId: "seed",
      action: "database.seeded",
      entityType: "database",
      entityId: "techciti_reports",
      meta: { tutors: tutors.length, students: students.length, assignments: assignments.length },
    },
  });

  console.log("\nDone. Sign in at the admin portal with:");
  console.log(`  email:    ${process.env.SUPER_ADMIN_EMAIL ?? "admin@techciti.ng"}`);
  console.log(`  password: ${process.env.SUPER_ADMIN_PASSWORD ?? "TechCiti2026!"}`);
  console.log("\nTutor portal links (token → URL):");
  for (const tutor of tutors) {
    console.log(`  ${tutor.fullName.padEnd(18)} ${(process.env.TUTOR_PORTAL_URL ?? "http://localhost:3000").replace(/\/+$/, "")}/t/${tutor.accessToken}`);
  }
  console.log("");
}

main()
  .catch((error) => {
    console.error("\nSeed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
