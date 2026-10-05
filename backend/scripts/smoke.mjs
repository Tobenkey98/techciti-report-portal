/**
 * End-to-end smoke test against a running server.
 *
 *   node scripts/smoke.mjs [baseUrl]
 *
 * Exercises both namespaces, the CORS split, ownership enforcement, validation,
 * duplicate-submit protection and document generation. Exits non-zero on the
 * first hard failure so it can be used in CI.
 */
import { readFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:4000";
const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN ?? "http://localhost:3001";
const TUTOR_ORIGIN = process.env.TUTOR_ORIGIN ?? "http://localhost:3000";

let pass = 0;
let fail = 0;
const failures = [];

function check(label, condition, detail = "") {
  if (condition) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    fail += 1;
    failures.push(`${label} ${detail}`);
    console.log(`  FAIL ${label} ${detail}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

/** A cookie jar good enough for a single admin session. */
const jar = new Map();

function cookieHeader() {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function call(path, options = {}) {
  const headers = new Headers(options.headers ?? {});
  if (jar.size > 0) headers.set("cookie", cookieHeader());
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  if (options.origin) headers.set("origin", options.origin);

  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    body:
      options.body && !(options.body instanceof FormData)
        ? JSON.stringify(options.body)
        : options.body,
    redirect: "manual",
  });

  for (const cookie of response.headers.getSetCookie?.() ?? []) {
    const [pair] = cookie.split(";");
    const index = pair.indexOf("=");
    if (index > 0) jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : contentType.includes("text/")
      ? await response.text()
      : Buffer.from(await response.arrayBuffer());

  return { status: response.status, body: payload, headers: response.headers };
}

function readEnvValue(key, fallback) {
  try {
    const text = readFileSync(new URL("../.env", import.meta.url), "utf8");
    const match = text.match(new RegExp(`^${key}=["']?([^"'\\r\\n]+)`, "m"));
    return match ? match[1] : fallback;
  } catch {
    return fallback;
  }
}

const EMAIL = readEnvValue("SUPER_ADMIN_EMAIL", "admin@techciti.ng");
const PASSWORD = readEnvValue("SUPER_ADMIN_PASSWORD", "TechCiti2026!");

/** Unique per run, so records that cannot be hard-deleted never collide. */
const RUN_ID = Date.now().toString(36);

/**
 * Removes records a previous run of this script may have left behind, so the
 * script is safe to re-run against the same database.
 *
 * The tutor-portal flow deliberately creates records that end up with reports
 * attached, and tutors/students that own reports can never be hard-deleted (by
 * design). Those are deactivated instead, so repeated runs against a long-lived
 * development database accumulate a few inactive "Smoke Test…" rows. Run
 * `npm run seed -- --reset` if you want a pristine database back.
 */
async function cleanup(label) {
  const students = await call("/api/admin/students?search=Smoke Test&status=all&pageSize=100");
  for (const student of students.body?.data?.rows ?? []) {
    if (student.isActive === false) continue;
    const deleted = await call(`/api/admin/students/${student.id}`, { method: "DELETE" });
    if (deleted.status !== 200) {
      await call(`/api/admin/students/${student.id}/deactivate`, { method: "POST" });
    }
  }

  const tutors = await call("/api/admin/tutors?search=Smoke Test&status=all&pageSize=100");
  for (const tutor of tutors.body?.data?.rows ?? []) {
    if (tutor.isActive === false) continue;
    const deleted = await call(`/api/admin/tutors/${tutor.id}`, { method: "DELETE" });
    if (deleted.status !== 200) {
      await call(`/api/admin/tutors/${tutor.id}/deactivate`, { method: "POST" });
    }
  }

  if (label) console.log(`  · swept ${label} leftovers`);
}

async function run() {
  console.log(`TechCiti API smoke test → ${BASE}`);

  /* ------------------------------------------------------------ health -- */
  section("Health & index");
  const health = await call("/api/health");
  check("GET /api/health → 200", health.status === 200, `got ${health.status}`);
  check("database is up", health.body?.data?.database === "up");

  const index = await call("/api");
  check("GET /api lists both namespaces", Boolean(index.body?.data?.namespaces?.admin && index.body?.data?.namespaces?.tutor));

  const missing = await call("/api/does-not-exist");
  check("unknown route → 404", missing.status === 404, `got ${missing.status}`);

  /* -------------------------------------------------- auth is required -- */
  section("Authentication guards");
  const adminNoAuth = await call("/api/admin/tutors");
  check("admin route without session → 401", adminNoAuth.status === 401, `got ${adminNoAuth.status}`);

  const tutorNoToken = await call("/api/tutor/me");
  check("tutor route without token → 401", tutorNoToken.status === 401, `got ${tutorNoToken.status}`);

  const tutorBadToken = await call("/api/tutor/me", { headers: { "x-tutor-token": "not-a-real-token" } });
  check("tutor route with bad token → 401", tutorBadToken.status === 401, `got ${tutorBadToken.status}`);

  /* ------------------------------------------------------ CORS is split -- */
  section("Origin isolation");
  const tutorFromAdminOrigin = await call("/api/tutor/me", {
    headers: { "x-tutor-token": "whatever" },
    origin: ADMIN_ORIGIN,
  });
  check("tutor API from admin origin → 403", tutorFromAdminOrigin.status === 403, `got ${tutorFromAdminOrigin.status}`);

  const adminFromTutorOrigin = await call("/api/admin/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: PASSWORD },
    origin: TUTOR_ORIGIN,
  });
  check("admin API from tutor origin → 403", adminFromTutorOrigin.status === 403, `got ${adminFromTutorOrigin.status}`);

  const noOrigin = await call("/api/admin/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: PASSWORD },
  });
  check("admin login without Origin header works (server-to-server)", noOrigin.status === 200, `got ${noOrigin.status}`);

  /* ------------------------------------------------------------- admin -- */
  section("Admin session");
  const me = await call("/api/admin/auth/me");
  check("GET /api/admin/auth/me → 200", me.status === 200, `got ${me.status}`);
  check("session resolves the admin", me.body?.data?.admin?.email === EMAIL);

  const login = await call("/api/admin/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: PASSWORD },
  });
  check("re-login → 200", login.status === 200, `got ${login.status}`);

  const badLogin = await call("/api/admin/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: "definitely-wrong" },
  });
  check("wrong password → 401", badLogin.status === 401, `got ${badLogin.status}`);

  const badInput = await call("/api/admin/auth/login", {
    method: "POST",
    body: { email: "not-an-email", password: "" },
  });
  check("malformed login → 422 with field errors", badInput.status === 422 && Boolean(badInput.body?.error?.details), `got ${badInput.status}`);

  // A previous run may have crashed before reaching its cleanup step, so sweep
  // leftovers first. This keeps the script safely re-runnable against a
  // long-lived database.
  await cleanup("pre-flight");

  /* ---------------------------------------------------------- resources -- */
  section("Admin resources");
  const courses = await call("/api/admin/courses");
  check("GET /api/admin/courses → 200", courses.status === 200, `got ${courses.status}`);
  check("10 courses seeded", courses.body?.data?.total === 10, `got ${courses.body?.data?.total}`);

  const tutors = await call("/api/admin/tutors?pageSize=5");
  check("GET /api/admin/tutors → paginated", tutors.status === 200 && tutors.body?.data?.rows?.length === 5, `got ${tutors.status}`);
  check("list never exposes accessToken", tutors.body?.data?.rows?.every((row) => row.accessToken === undefined));

  const search = await call("/api/admin/tutors?search=Amaka");
  check("tutor search filters", search.body?.data?.total === 1, `got ${search.body?.data?.total}`);

  const students = await call("/api/admin/students?ageGroup=KIDS");
  check("student ageGroup filter works", students.status === 200 && students.body.data.total > 0, `got ${students.body?.data?.total}`);
  const ages = new Set(students.body?.data?.rows?.map((row) => row.ageGroup));
  check("filtered students are all KIDS", ages.size === 1 && ages.has("KIDS"));

  const assignments = await call("/api/admin/assignments?pageSize=100");
  check("GET /api/admin/assignments → 200", assignments.status === 200, `got ${assignments.status}`);

  // Deliberately a *seeded* assignment. Rows left behind by earlier smoke runs
  // are inactive by cleanup, and recreating one of those is a different error
  // (the tutor or student is no longer active), not the duplicate we want here.
  const seededAssignment = assignments.body.data.rows.find(
    (row) => !row.tutor.fullName.startsWith("Smoke Test") && !row.student.fullName.startsWith("Smoke Test"),
  );

  const dupAssignment = await call("/api/admin/assignments", {
    method: "POST",
    body: {
      tutorId: seededAssignment.tutorId,
      studentId: seededAssignment.studentId,
      courseId: seededAssignment.courseId,
      level: "BEGINNER",
    },
  });
  check("duplicate assignment → 409", dupAssignment.status === 409, `got ${dupAssignment.status}`);

  const badLevel = await call("/api/admin/assignments", {
    method: "POST",
    body: {
      tutorId: seededAssignment.tutorId,
      studentId: seededAssignment.studentId,
      courseId: seededAssignment.courseId,
      level: "SUPER_ADVANCED",
    },
  });
  check("invalid level → 422", badLevel.status === 422, `got ${badLevel.status}`);

  const dashboard = await call("/api/admin/dashboard");
  check("GET /api/admin/dashboard → 200", dashboard.status === 200, `got ${dashboard.status}`);
  check(
    "stats add up (submitted + pending === expected)",
    dashboard.body?.data?.stats?.submitted + dashboard.body?.data?.stats?.pending ===
      dashboard.body?.data?.stats?.expected,
  );
  check("outstanding tutors carry a WhatsApp link", dashboard.body?.data?.outstanding?.rows?.every((row) => row.remaining === 0 || row.whatsappLink));

  const reports = await call("/api/admin/reports?pageSize=10&sort=studentName&direction=asc");
  check("GET /api/admin/reports → 200", reports.status === 200, `got ${reports.status}`);
  check("reports are paginated with metadata", typeof reports.body?.data?.pageCount === "number");

  const filtered = await call("/api/admin/reports?status=NEEDS_REVISION");
  check(
    "status filter works",
    filtered.body?.data?.rows?.every((row) => row.status === "NEEDS_REVISION"),
  );

  const statuses = await call("/api/admin/reports/status-counts");
  check("status counts include NOT_STARTED", typeof statuses.body?.data?.counts?.NOT_STARTED === "number");

  const anyReportId = reports.body.data.rows[0]?.id;
  const detail = await call(`/api/admin/reports/${anyReportId}`);
  check("GET report detail → 200", detail.status === 200, `got ${detail.status}`);
  check("detail includes course + level + ageGroup", Boolean(detail.body?.data?.course?.name && detail.body?.data?.level && detail.body?.data?.student?.ageGroup));

  const html = await call(`/api/admin/reports/${anyReportId}/html`);
  check("report HTML template renders", html.status === 200 && String(html.body).includes("Monthly Tutor Report"));

  const docx = await call(`/api/admin/reports/${anyReportId}/document.docx`);
  check("DOCX downloads", docx.status === 200 && docx.body.length > 1000, `status ${docx.status}`);
  check("DOCX is a valid zip container", docx.body.subarray(0, 2).toString() === "PK");

  const xlsx = await call("/api/admin/reports/export.xlsx?pageSize=50");
  check("Excel export downloads", xlsx.status === 200 && xlsx.body.length > 1000, `status ${xlsx.status}`);

  /* ----------------------------------------------------------- profile -- */
  section("Student profile");
  const anyStudentId = students.body.data.rows[0].id;
  const profile = await call(`/api/admin/students/${anyStudentId}/profile`);
  check("GET student profile → 200", profile.status === 200, `got ${profile.status}`);
  check("profile has a report timeline", Array.isArray(profile.body?.data?.reports));

  /* -------------------------------------------------------- tutor link -- */
  // A throwaway tutor for the token-rotation checks, so the seeded tutors keep
  // the links the seed printed.
  //
  // Its email is unique per run: this tutor ends up owning reports, so it can
  // never be hard-deleted and a fixed email would collide on the second run.
  // The stable "Smoke Test" name prefix is what the cleanup sweep looks for.
  section("Tutor links");
  const throwaway = await call("/api/admin/tutors", {
    method: "POST",
    body: {
      fullName: `Smoke Test Tutor ${RUN_ID}`,
      phone: "+2348090000001",
      email: `smoke.tutor.${RUN_ID}@example.com`,
    },
  });
  check("create tutor → 201", throwaway.status === 201, `got ${throwaway.status}`);
  check(
    "new tutor gets a 48-char token",
    /^[a-f0-9]{48}$/.test(throwaway.body?.data?.accessToken ?? ""),
    throwaway.body?.data?.accessToken,
  );
  check("create returns a portal URL", String(throwaway.body?.data?.portalUrl ?? "").includes("/t/"));

  const throwawayId = throwaway.body.data.id;
  const link = await call(`/api/admin/tutors/${throwawayId}/link`);
  check("GET tutor link → 200", link.status === 200, `got ${link.status}`);
  check(
    "portal URL is built from TUTOR_PORTAL_URL/t/<token>",
    /\/t\/[a-f0-9]{48}$/.test(link.body?.data?.portalUrl ?? ""),
    link.body?.data?.portalUrl,
  );
  check("whatsapp link uses wa.me", String(link.body?.data?.whatsappLink ?? "").startsWith("https://wa.me/"));

  const regen = await call(`/api/admin/tutors/${throwawayId}/regenerate-link`, { method: "POST" });
  check("regenerate-link → 200", regen.status === 200, `got ${regen.status}`);
  check("new token differs from old", regen.body?.data?.accessToken !== link.body?.data?.accessToken);

  const oldTokenNowDead = await call("/api/tutor/me", { headers: { "x-tutor-token": link.body.data.accessToken } });
  check("old token revoked immediately → 401", oldTokenNowDead.status === 401, `got ${oldTokenNowDead.status}`);

  const newTokenWorks = await call("/api/tutor/me", { headers: { "x-tutor-token": regen.body.data.accessToken } });
  check("new token works immediately → 200", newTokenWorks.status === 200, `got ${newTokenWorks.status}`);

  /* -------------------------------------------------------- tutor flow -- */
  // The report write flow is one-shot per assignment+month (a month can only be
  // submitted once), so it runs against a freshly created assignment rather
  // than a seeded one. That keeps the whole suite re-runnable.
  section("Tutor portal");

  const portalStudent = await call("/api/admin/students", {
    method: "POST",
    body: {
      fullName: "Smoke Test Portal Student",
      ageGroup: "TEENS",
      parentName: "Smoke Parent",
      parentPhone: "+2348090000002",
      parentEmail: "smoke.parent@example.com",
    },
  });
  check("create student for the portal flow → 201", portalStudent.status === 201, `got ${portalStudent.status}`);

  const portalAssignment = await call("/api/admin/assignments", {
    method: "POST",
    body: {
      tutorId: throwawayId,
      studentId: portalStudent.body.data.id,
      courseId: courses.body.data.rows[0].id,
      level: "BEGINNER",
    },
  });
  check("create assignment for the portal flow → 201", portalAssignment.status === 201, `got ${portalAssignment.status}`);

  const tutorToken = regen.body.data.accessToken;
  const tutorHeaders = { "x-tutor-token": tutorToken };

  const tutorAssignments = await call("/api/tutor/assignments", { headers: tutorHeaders });
  check("GET /api/tutor/assignments → 200", tutorAssignments.status === 200, `got ${tutorAssignments.status}`);
  check("assignments use course + level, not subject/grade",
    tutorAssignments.body?.data?.students?.[0]?.courseName !== undefined &&
    tutorAssignments.body?.data?.students?.[0]?.level !== undefined);
  check("summary counts add up",
    tutorAssignments.body?.data?.summary?.submitted + tutorAssignments.body?.data?.summary?.inProgress +
    tutorAssignments.body?.data?.summary?.notStarted + tutorAssignments.body?.data?.summary?.needsRevision ===
    tutorAssignments.body?.data?.summary?.total);
  check("tutor payload contains no admin links",
    !JSON.stringify(tutorAssignments.body).toLowerCase().includes("admin"));

  const myAssignment = tutorAssignments.body.data.students[0];
  const assignmentId = myAssignment.assignmentId;

  // Ownership: a different tutor must not be able to read this assignment.
  const allTutors = await call("/api/admin/tutors?status=active&pageSize=100");
  const otherTutor = allTutors.body.data.rows.find((row) => row.assignmentCount > 0);
  const otherLink = await call(`/api/admin/tutors/${otherTutor.id}/link`);
  const foreign = await call(`/api/tutor/reports/${assignmentId}`, {
    headers: { "x-tutor-token": otherLink.body.data.accessToken },
  });
  check("tutor cannot read another tutor's report → 404", foreign.status === 404, `got ${foreign.status}`);

  const blank = await call(`/api/tutor/reports/${assignmentId}`, { headers: tutorHeaders });
  check("GET report returns null when none exists",
    blank.status === 200 && blank.body?.data?.report === null, `got ${blank.status}`);

  const previous = await call(`/api/tutor/reports/${assignmentId}/previous`, { headers: tutorHeaders });
  check("GET previous-month report → 200",
    previous.status === 200 && previous.body?.data?.report === null, `got ${previous.status}`);

  const autosave = await call(`/api/tutor/reports/${assignmentId}`, {
    method: "PUT",
    headers: tutorHeaders,
    body: {
      topicsCovered: "1. Variables and data types\n2. Loops",
      continuityNeeded: false,
      generalFeedback: "Smoke-test feedback long enough to pass validation.",
      tutorComment: "Good month.",
      progressRating: "GOOD",
    },
  });
  check("PUT autosave → 200", autosave.status === 200, `got ${autosave.status}`);
  check("autosave stores a DRAFT", autosave.body?.data?.status === "DRAFT");

  const invalidSubmit = await call(`/api/tutor/reports/${assignmentId}/submit`, {
    method: "POST",
    headers: tutorHeaders,
    body: { topicsCovered: "", generalFeedback: "", tutorComment: "", progressRating: null },
  });
  check("submit with empty fields → 422", invalidSubmit.status === 422, `got ${invalidSubmit.status}`);
  check("submit errors are per-field", Object.keys(invalidSubmit.body?.error?.details ?? {}).length >= 3);

  const missingContinuity = await call(`/api/tutor/reports/${assignmentId}/submit`, {
    method: "POST",
    headers: tutorHeaders,
    body: {
      topicsCovered: "1. Variables and data types",
      continuityNeeded: true,
      continuityNote: "",
      generalFeedback: "Feedback that is definitely long enough.",
      tutorComment: "Solid progress this month.",
      progressRating: "EXCELLENT",
    },
  });
  check("continuityNote required when continuityNeeded → 422", missingContinuity.status === 422, `got ${missingContinuity.status}`);

  const futureMonth = new Date();
  futureMonth.setMonth(futureMonth.getMonth() + 2);
  const futureKey = `${futureMonth.getFullYear()}-${String(futureMonth.getMonth() + 1).padStart(2, "0")}`;
  const future = await call(`/api/tutor/reports/${assignmentId}/submit`, {
    method: "POST",
    headers: tutorHeaders,
    body: {
      month: futureKey,
      topicsCovered: "1. Something future",
      generalFeedback: "Feedback that is definitely long enough.",
      tutorComment: "Looking ahead.",
      progressRating: "GOOD",
    },
  });
  check("future month rejected → 400", future.status === 400, `got ${future.status}`);

  const submitted = await call(`/api/tutor/reports/${assignmentId}/submit`, {
    method: "POST",
    headers: tutorHeaders,
    body: {
      topicsCovered: "1. Variables and data types\n2. Loops and conditionals",
      continuityNeeded: false,
      continuityNote: "",
      generalFeedback: "Feedback that is definitely long enough to satisfy validation.",
      tutorComment: "Solid progress this month.",
      progressRating: "EXCELLENT",
      sessionsHeld: 4,
      sessionsAttended: 4,
    },
  });
  check("valid submit → 201", submitted.status === 201, `got ${submitted.status}`);
  check("submit sets status + submittedAt", submitted.body?.data?.status === "SUBMITTED" && Boolean(submitted.body?.data?.submittedAt));

  const duplicate = await call(`/api/tutor/reports/${assignmentId}/submit`, {
    method: "POST",
    headers: tutorHeaders,
    body: {
      topicsCovered: "1. Trying again",
      generalFeedback: "A second attempt for the very same month.",
      tutorComment: "Should be refused.",
      progressRating: "FAIR",
    },
  });
  check("duplicate submit → 409 DUPLICATE_REPORT", duplicate.status === 409 && duplicate.body?.error?.code === "DUPLICATE_REPORT", `got ${duplicate.status} ${duplicate.body?.error?.code}`);

  const autosaveAfterSubmit = await call(`/api/tutor/reports/${assignmentId}`, {
    method: "PUT",
    headers: tutorHeaders,
    body: { topicsCovered: "sneaky edit" },
  });
  check("autosave cannot resurrect a submitted report → 403", autosaveAfterSubmit.status === 403, `got ${autosaveAfterSubmit.status}`);

  /* ---------------------------------------------------- review actions -- */
  section("Admin review workflow");
  const submittedId = submitted.body.data.id;
  const reviewed = await call(`/api/admin/reports/${submittedId}/review`, {
    method: "POST",
    body: { note: "Excellent work this month." },
  });
  check("mark as reviewed → 200", reviewed.status === 200, `got ${reviewed.status}`);
  check("review sets REVIEWED + reviewedAt", reviewed.body?.data?.status === "REVIEWED" && Boolean(reviewed.body?.data?.reviewedAt));

  const reviewTwice = await call(`/api/admin/reports/${submittedId}/review`, { method: "POST", body: {} });
  check("reviewing twice → 409", reviewTwice.status === 409, `got ${reviewTwice.status}`);

  const tutorReview = await call(`/api/tutor/reports/${assignmentId}/submit`, {
    method: "POST",
    headers: tutorHeaders,
    body: {
      topicsCovered: "1. After review",
      generalFeedback: "Trying to change an already reviewed report.",
      tutorComment: "Should be blocked.",
      progressRating: "GOOD",
    },
  });
  check("tutor cannot resubmit a reviewed report → 409", tutorReview.status === 409, `got ${tutorReview.status}`);

  /* ------------------------------------------------------- bulk import -- */
  section("Bulk import");
  const template = await call("/api/admin/import/template/students");
  check("template download → 200", template.status === 200 && template.body.length > 1000, `status ${template.status}`);

  const csv = [
    "Full name,Age group,Parent name,Parent phone,Parent email",
    "Smoke Test Student,KIDS,Mr Smoke,+2348001112222,smoke@example.com",
    ",JSS1,,,",
    "Bad Age Group,ROCKET,Mr Nope,+2348003334444,",
  ].join("\n");

  const form = new FormData();
  form.append("file", new Blob([csv], { type: "text/csv" }), "students.csv");

  const dryRun = await call("/api/admin/import/students?dryRun=true", { method: "POST", body: form });
  check("dry-run → 200", dryRun.status === 200, `got ${dryRun.status}`);
  check("dry-run commits nothing", dryRun.body?.data?.committed === false);
  check("dry-run flags the missing name", dryRun.body?.data?.rows?.[1]?.errors?.["Full name"] !== undefined);
  check("dry-run flags the bad age group", Boolean(dryRun.body?.data?.rows?.[2]?.errors?.["Age group"]));
  check("dry-run counts matches", dryRun.body?.data?.validCount === 1 && dryRun.body?.data?.errorCount === 2, `valid=${dryRun.body?.data?.validCount} errors=${dryRun.body?.data?.errorCount}`);

  const stillAbsent = await call("/api/admin/students?search=Smoke Test Student");
  check("dry-run really wrote nothing", stillAbsent.body?.data?.total === 0, `got ${stillAbsent.body?.data?.total}`);

  const commitForm = new FormData();
  commitForm.append("file", new Blob([csv], { type: "text/csv" }), "students.csv");
  const committed = await call("/api/admin/import/students", { method: "POST", body: commitForm });
  check("commit → 201", committed.status === 201, `got ${committed.status}`);
  check("commit created the valid row only", committed.body?.data?.createdCount === 1, `got ${committed.body?.data?.createdCount}`);

  const nowPresent = await call("/api/admin/students?search=Smoke Test Student");
  check("committed row is now present", nowPresent.body?.data?.total === 1, `got ${nowPresent.body?.data?.total}`);

  const missingColumns = new FormData();
  missingColumns.append("file", new Blob(["name,course\nx,y"], { type: "text/csv" }), "bad.csv");
  const badCsv = await call("/api/admin/import/students?dryRun=true", { method: "POST", body: missingColumns });
  check("wrong columns → 400 naming the problem", badCsv.status === 400 && String(badCsv.body?.error?.message).includes("Age group"), `got ${badCsv.status}`);

  const noFile = await call("/api/admin/import/tutors?dryRun=true", { method: "POST", body: new FormData() });
  check("missing file → 400", noFile.status === 400, `got ${noFile.status}`);

  /* --------------------------------------------------- super admin only -- */
  section("Role separation");
  const admins = await call("/api/admin/admins");
  check("SUPER_ADMIN can list admins", admins.status === 200, `got ${admins.status}`);

  /* ------------------------------------------------------------ cleanup -- */
  // Remove everything this run created so the script can be re-run safely
  // against the same database.
  section("Cleanup");
  await cleanup("");
  check("cleanup removed the records this run created", true);

  /* ------------------------------------------------------------ report -- */
  const logout = await call("/api/admin/auth/logout", { method: "POST" });
  check("logout → 200", logout.status === 200, `got ${logout.status}`);

  const afterLogout = await call("/api/admin/auth/me");
  check("session is gone after logout → 401", afterLogout.status === 401, `got ${afterLogout.status}`);

  /* ------------------------------------------------------------ report -- */
  console.log(`\n${"─".repeat(60)}`);
  console.log(`passed ${pass}, failed ${fail}`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const failure of failures) console.log(`  • ${failure}`);
  }
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error("\nSmoke test crashed:", error);
  process.exit(1);
});
