import { SUBJECTS, TOPIC_SUGGESTIONS } from "@/lib/constants";
import type {
  Assignment,
  Instructor,
  MonthKey,
  ProgressRating,
  Report,
  ReportStatus,
  Student,
} from "@/lib/types";
import { getCurrentMonth, monthsAgo, shiftMonth } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * Deterministic mock dataset.
 *
 * Everything here is generated from a fixed seed so that server and
 * client render identical data (no hydration warnings) and so every
 * reload gives you the same, realistic-looking demo.
 *
 * Replace this file with real HTTP calls in `lib/api.ts` — nothing else
 * in the app imports from here directly except the API layer.
 * ------------------------------------------------------------------ */

/** mulberry32 — tiny deterministic PRNG. */
function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(random: () => number, items: readonly T[]): T =>
  items[Math.floor(random() * items.length)];

function pickMany<T>(random: () => number, items: readonly T[], count: number): T[] {
  const pool = [...items];
  const chosen: T[] = [];
  const target = Math.min(count, pool.length);
  for (let index = 0; index < target; index += 1) {
    const [item] = pool.splice(Math.floor(random() * pool.length), 1);
    if (item !== undefined) chosen.push(item);
  }
  return chosen;
}

/**
 * Deterministic timestamp helper.
 *
 * `seed` keeps the minutes offset stable so server and client produce byte-identical
 * ISO strings (no hydration mismatches, no flaky snapshots).
 */
function isoAt(dayOffset: number, hour = 9, seed = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, Math.abs(seed * 7) % 60, 0, 0);
  return date.toISOString();
}

/* --------------------------------- Tutors --------------------------------- */

const TUTOR_SEEDS: {
  fullName: string;
  email: string;
  phone: string;
  token: string;
  subjects: string[];
  status: Instructor["status"];
}[] = [
  {
    fullName: "Amaka Obi",
    email: "amaka.obi@techciti.ng",
    phone: "2348031152201",
    token: "amaka-obi-9f2c",
    subjects: ["Mathematics", "Further Mathematics"],
    status: "active",
  },
  {
    fullName: "Ibrahim Yusuf",
    email: "ibrahim.yusuf@techciti.ng",
    phone: "2348057740093",
    token: "ibrahim-yusuf-4d71",
    subjects: ["Mathematics", "Basic Science"],
    status: "active",
  },
  {
    fullName: "Chioma Eze",
    email: "chioma.eze@techciti.ng",
    phone: "2348094417726",
    token: "chioma-eze-77b5",
    subjects: ["English Language", "Social Studies"],
    status: "active",
  },
  {
    fullName: "Segun Adeyemi",
    email: "segun.adeyemi@techciti.ng",
    phone: "2347063185490",
    token: "segun-adeyemi-1c8a",
    subjects: ["Computer Studies", "Basic Technology"],
    status: "active",
  },
  {
    fullName: "Fatima Bello",
    email: "fatima.bello@techciti.ng",
    phone: "2348126673408",
    token: "fatima-bello-6e03",
    subjects: ["Basic Science", "Civic Education"],
    status: "active",
  },
];

/* -------------------------------- Students -------------------------------- */

const STUDENT_SEEDS: {
  fullName: string;
  grade: string;
  gender: Student["gender"];
  parentName: string;
  parentPhone: string;
}[] = [
  { fullName: "Chidera Nwosu", grade: "Primary 5", gender: "Female", parentName: "Mrs Ngozi Nwosu", parentPhone: "2348032241877" },
  { fullName: "Emeka Okonkwo", grade: "Primary 5", gender: "Male", parentName: "Mr Chuka Okonkwo", parentPhone: "2348059012264" },
  { fullName: "Zainab Balogun", grade: "Primary 6", gender: "Female", parentName: "Mrs Bisi Balogun", parentPhone: "2348120049981" },
  { fullName: "Tobi Akinwale", grade: "JSS 1", gender: "Male", parentName: "Mr Femi Akinwale", parentPhone: "2347061185530" },
  { fullName: "Adaora Nkemelu", grade: "JSS 1", gender: "Female", parentName: "Mrs Ifeoma Nkemelu", parentPhone: "2348137761002" },
  { fullName: "Suleiman Danjuma", grade: "JSS 2", gender: "Male", parentName: "Alhaji Danjuma Musa", parentPhone: "2348093377614" },
  { fullName: "Blessing Etim", grade: "JSS 2", gender: "Female", parentName: "Mrs Rose Etim", parentPhone: "2348025590043" },
  { fullName: "David Mensah", grade: "JSS 3", gender: "Male", parentName: "Mr Kojo Mensah", parentPhone: "2348142200871" },
  { fullName: "Aisha Muhammad", grade: "JSS 3", gender: "Female", parentName: "Mrs Halima Muhammad", parentPhone: "2348036672918" },
  { fullName: "Oluwaseun Fashola", grade: "SSS 1", gender: "Male", parentName: "Mrs Adebayo Fashola", parentPhone: "2348051204478" },
  { fullName: "Ngozi Uche", grade: "SSS 1", gender: "Female", parentName: "Mr Uche Nwosu", parentPhone: "2347018845229" },
  { fullName: "Yusuf Tanko", grade: "SSS 2", gender: "Male", parentName: "Mr Tanko Yusuf", parentPhone: "2348099903317" },
  { fullName: "Esther Bassey", grade: "SSS 2", gender: "Female", parentName: "Mrs Lucy Bassey", parentPhone: "2348147753106" },
  { fullName: "Kelechi Anyanwu", grade: "SSS 3", gender: "Male", parentName: "Mr Nnaemeka Anyanwu", parentPhone: "2348022298845" },
  { fullName: "Hauwa Yusuf", grade: "SSS 3", gender: "Female", parentName: "Musa Yusuf", parentPhone: "2348065541932" },
  { fullName: "Somtochukwu Igwe", grade: "Primary 4", gender: "Male", parentName: "Mrs Nkemelu Igwe", parentPhone: "2348107734128" },
  { fullName: "Amina Lawal", grade: "Primary 4", gender: "Female", parentName: "Mr Sadiq Lawal", parentPhone: "2348031186694" },
  { fullName: "Boluwatife Adeyinka", grade: "Primary 6", gender: "Female", parentName: "Mr Wale Adeyinka", parentPhone: "2347052299013" },
  { fullName: "Ibrahim Sanni", grade: "JSS 1", gender: "Male", parentName: "Mr Sanni Ibrahim", parentPhone: "2348130077451" },
  { fullName: "Precious Okafor", grade: "SSS 2", gender: "Female", parentName: "Mrs Ifeoma Okafor", parentPhone: "2348096612284" },
];

/* ----------------------------- Copy generators ----------------------------- */

const FEEDBACK_POSITIVE = [
  "{name} has been focused and enthusiastic in {subject} this month. Participation in class activities has improved noticeably, and {pronoun} completed all assigned exercises.",
  "{name} approached {subject} with real enthusiasm. {Pronoun} asks thoughtful questions and is happy to attempt difficult problems independently.",
  "It has been a rewarding month for {name}. {Pronoun} consistently contributes in {subject} and supports classmates during group work.",
];

const FEEDBACK_MIXED = [
  "{name} is making steady progress in {subject}. Concepts are grasped with support, and {pronoun} responds well to guided practice.",
  "{name} shows improving confidence in {subject}. Accuracy in written work has improved, though {pronoun} still needs to slow down and check {possessive} answers.",
  "{name} participates willingly in {subject}. With consistent home practice, {pronoun} should reach the class average comfortably this term.",
];

const FEEDBACK_NEEEDS_WORK = [
  "{name} struggled to keep pace with the {subject} curriculum this month. Foundational gaps are slowing {pronoun} down in class.",
  "{name} found this month's {subject} topics challenging and needs closer supervision with homework to avoid falling behind.",
];

const CONTINUITY_NOTES = [
  "Continue with the same topic next month until {name} is confident with the foundational skills.",
  "Repeat the introduction to {subject} concepts with more practical examples before moving to the next sub-topic.",
  "Follow up with targeted remedial sessions on the areas assessed this month.",
];

const TUTOR_COMMENTS = [
  "Parent is very engaged and checks in weekly. Keep an eye on confidence before exams.",
  "Learner works best in small groups — please consider pairing with a peer mentor.",
  "Attendance has been consistent. Focus next month on exam technique.",
  "Family is requesting extra worksheets. Consider a booster pack.",
  "Progress is real but slow; recommend fortnightly check-ins with the parent.",
  "No concerns from the class teacher this month.",
];

function fillTemplate(template: string, name: string, subject: string): string {
  const first = name.split(/\s+/)[0] ?? name;
  return template
    .replace(/\{name\}/g, name)
    .replace(/\{firstName\}/g, first)
    .replace(/\{subject\}/g, subject)
    .replace(/\{pronoun\}/g, "they")
    .replace(/\{Pronoun\}/g, "They")
    .replace(/\{possessive\}/g, "their");
}

function buildTopics(random: () => number, subject: string): string {
  const pool = (TOPIC_SUGGESTIONS as Record<string, readonly string[] | undefined>)[
    subject
  ] ?? (SUBJECTS.includes(subject as never) ? SUBJECTS : [subject]);
  const topics = pickMany(random, pool as readonly string[], 3 + Math.floor(random() * 3));
  return topics.map((topic, index) => `${index + 1}. ${topic}`).join("\n");
}

/* ------------------------------- Assembling ------------------------------- */

function buildInstructors(): Instructor[] {
  return TUTOR_SEEDS.map((seed, index) => ({
    id: `tut_${String(index + 1).padStart(3, "0")}`,
    fullName: seed.fullName,
    email: seed.email,
    phone: seed.phone,
    token: seed.token,
    subjects: seed.subjects,
    status: seed.status,
    createdAt: isoAt(-220 + index * 11, 8, index),
  }));
}

function buildStudents(): Student[] {
  return STUDENT_SEEDS.map((seed, index) => ({
    id: `stu_${String(index + 1).padStart(3, "0")}`,
    fullName: seed.fullName,
    grade: seed.grade,
    gender: seed.gender,
    parentName: seed.parentName,
    parentPhone: seed.parentPhone,
    status: "active",
    createdAt: isoAt(-200 + index * 7, 8, index),
  }));
}

/**
 * Tutor -> [student index, subject] pairs. A student can appear more than once
 * when they sit two subjects (or two tutors) — that is the whole point of the
 * assignments table.
 */
const ASSIGNMENT_PLAN: [tutorIndex: number, studentIndex: number, subject: string][] = [
  [0, 0, "Mathematics"],
  [0, 2, "Mathematics"],
  [0, 5, "Further Mathematics"],
  [0, 9, "Mathematics"],
  [0, 13, "Mathematics"],
  [1, 1, "Mathematics"],
  [1, 3, "Basic Science"],
  [1, 4, "Mathematics"],
  [1, 6, "Basic Science"],
  [1, 11, "Mathematics"],
  [1, 18, "Basic Science"],
  [2, 0, "English Language"],
  [2, 2, "English Language"],
  [2, 3, "Social Studies"],
  [2, 7, "English Language"],
  [2, 10, "English Language"],
  [2, 16, "English Language"],
  [2, 18, "English Language"],
  [3, 4, "Computer Studies"],
  [3, 5, "Computer Studies"],
  [3, 6, "Basic Technology"],
  [3, 8, "Computer Studies"],
  [3, 18, "Computer Studies"],
  [4, 7, "Basic Science"],
  [4, 8, "Civic Education"],
  [4, 12, "Basic Science"],
  [4, 15, "Civic Education"],
  [4, 17, "Basic Science"],
  [4, 19, "Civic Education"],
];

function buildAssignments(instructors: Instructor[], students: Student[]): Assignment[] {
  return ASSIGNMENT_PLAN.map(([tutorIndex, studentIndex, subject], index) => ({
    id: `asg_${String(index + 1).padStart(3, "0")}`,
    instructorId: instructors[tutorIndex]?.id ?? "tut_001",
    studentId: students[studentIndex]?.id ?? "stu_001",
    subject,
    createdAt: isoAt(-180 + index, 8, index),
  }));
}

/** Which months have report history, oldest first. */
const HISTORY_MONTHS: MonthKey[] = [monthsAgo(2), monthsAgo(1), getCurrentMonth()];

/**
 * Status mix per month so the dashboard looks believable in any month.
 * `not_started` means "no report row exists yet", which is how the API layer
 * represents a missing report — so it is skipped during seeding.
 */
type ReportSeedStatus = ReportStatus | "not_started";

const STATUS_WEIGHTS: Record<string, ReportSeedStatus[]> = {
  older: ["reviewed", "reviewed", "reviewed", "submitted", "reviewed", "needs_revision"],
  current: ["reviewed", "submitted", "submitted", "draft", "submitted", "not_started", "submitted", "not_started", "draft", "submitted", "needs_revision"],
};

const RATING_BY_STATUS: Record<ReportStatus, ProgressRating> = {
  draft: "Good",
  submitted: "Good",
  reviewed: "Excellent",
  needs_revision: "Fair",
};

function buildReports(
  assignments: Assignment[],
  students: Student[],
  currentMonth: MonthKey,
): Report[] {
  const reports: Report[] = [];

  HISTORY_MONTHS.forEach((month, monthIndex) => {
    const isCurrent = month === currentMonth;
    const random = seededRandom(9001 + monthIndex * 137);
    const pool = isCurrent ? STATUS_WEIGHTS.current : STATUS_WEIGHTS.older;

    assignments.forEach((assignment, assignmentIndex) => {
      // Earlier months are fully complete; the current month is partly filled in.
      const status = isCurrent ? pick(random, pool) : pick(random, pool);
      // No row at all for a student the tutor has not touched yet.
      if (status === "not_started") return;

      const student =
        students.find((candidate) => candidate.id === assignment.studentId) ?? students[0]!;
      const ratingSeed = pick(
        random,
        ["Excellent", "Good", "Good", "Fair", "Needs attention"] as ProgressRating[],
      );
      const rating =
        status === "needs_revision" && ratingSeed === "Excellent" ? "Fair" : ratingSeed;
      const continuityNeeded = rating === "Fair" || rating === "Needs attention";
      const feedbackPool =
        rating === "Excellent"
          ? FEEDBACK_POSITIVE
          : rating === "Fair" || rating === "Needs attention"
            ? FEEDBACK_NEEEDS_WORK
            : FEEDBACK_MIXED;

      const dayOffset = -Math.floor(random() * 26) - monthIndex * 2;
      const seed = monthIndex * 31 + assignmentIndex;
      const submitted = !isCurrent || status !== "draft";
      const submittedAt = submitted ? isoAt(dayOffset, 19, seed) : null;
      const reviewed = status === "reviewed";
      const reportId = `rep_${month.replace("-", "")}_${String(assignmentIndex + 1).padStart(3, "0")}`;

      reports.push({
        id: reportId,
        assignmentId: assignment.id,
        instructorId: assignment.instructorId,
        studentId: assignment.studentId,
        subject: assignment.subject,
        month,
        topicsCovered: buildTopics(random, assignment.subject),
        continuityNeeded,
        continuityNote: continuityNeeded
          ? fillTemplate(pick(random, CONTINUITY_NOTES), student.fullName, assignment.subject)
          : "",
        generalFeedback: fillTemplate(
          pick(random, feedbackPool),
          student.fullName,
          assignment.subject,
        ),
        tutorComment: pick(random, TUTOR_COMMENTS),
        progressRating: rating,
        status,
        submittedAt,
        reviewedAt: reviewed ? isoAt(dayOffset + 2, 11, seed) : null,
        reviewerNote:
          status === "needs_revision"
            ? "Please add specific examples from class activities and confirm the topics list with me before resubmitting."
            : null,
        createdAt: isoAt(dayOffset - 2, 8, seed),
        updatedAt: isoAt(dayOffset, 19, seed),
      });
    });
  });

  return reports;
}

function seedDatabase() {
  const currentMonth = getCurrentMonth();
  const instructors = buildInstructors();
  const students = buildStudents();
  const assignments = buildAssignments(instructors, students);
  const reports = buildReports(assignments, students, currentMonth);

  return {
    currentMonth,
    previousMonth: shiftMonth(currentMonth, -1),
    instructors,
    students,
    assignments,
    reports,
  };
}

export type MockDatabase = ReturnType<typeof seedDatabase>;

export const MOCK_DB: MockDatabase = seedDatabase();

/** Quick links used by the README / login page demo panel. */
export const DEMO_TUTOR_LINKS = MOCK_DB.instructors.map((tutor) => ({
  id: tutor.id,
  fullName: tutor.fullName,
  token: tutor.token,
  subjects: tutor.subjects,
  path: `/t/${tutor.token}`,
}));