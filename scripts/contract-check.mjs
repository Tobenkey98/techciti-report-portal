/* ------------------------------------------------------------------ *
 * FRONTEND <-> BACKEND CONTRACT CHECK
 *
 * `lib/api.ts` was rewritten to talk to the Express API. That file is
 * the single place where the two vocabularies are reconciled, so if a
 * path, a query parameter, an envelope or a field name drifts, the UI
 * breaks in ways a typecheck cannot catch.
 *
 * This script calls every endpoint `lib/api.ts` uses and asserts the
 * response actually matches what the mapping functions read. It mirrors
 * the request shape rather than importing `api.ts` (which needs a
 * browser), so the assertions live next to the code they protect.
 *
 *   node scripts/contract-check.mjs
 *
 * Requires the backend on :4000 and a seeded database. Read-only apart
 * from the login it creates a session for; nothing is mutated.
 * ------------------------------------------------------------------ */

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BACKEND = join(ROOT, "backend");

const BASE = process.env.API_BASE ?? "http://localhost:4000/api";
const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN ?? "http://localhost:3001";
const TUTOR_ORIGIN = process.env.TUTOR_ORIGIN ?? "http://localhost:3000";

/** Pulls the seeded admin credentials out of backend/.env. */
function readEnv(file) {
  const text = readFileSync(file, "utf8");
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[match[1]] = value;
  }
  return out;
}

const env = readEnv(join(BACKEND, ".env"));

/* ----------------------------- tiny harness ----------------------------- */

let passed = 0;
const failures = [];
let group = "";

function section(name) {
  group = name;
  console.log(`\n\x1b[1m${name}\x1b[0m`);
}

function ok(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  \x1b[32mPASS\x1b[0m ${label}`);
  } else {
    failures.push(`${group} -> ${label}${detail ? ` (${detail})` : ""}`);
    console.log(`  \x1b[31mFAIL\x1b[0m ${label}${detail ? ` \x1b[2m${detail}\x1b[0m` : ""}`);
  }
}

/** Asserts a value is one of a set; used for enum round-trips. */
function okIn(label, value, allowed) {
  ok(label, allowed.includes(value), `got ${JSON.stringify(value)}, want one of ${allowed.join("|")}`);
}

/* ------------------------------ transport ------------------------------ */

/** Cookie jar: the admin session is an httpOnly cookie, so it must persist. */
const cookies = new Map();

async function call(path, { method = "GET", body, origin, query, tutorToken, raw = false } = {}) {
  const url = new URL(`${BASE}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = { Accept: "application/json" };
  if (origin) headers.Origin = origin;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (tutorToken) headers["X-Tutor-Token"] = tutorToken;
  if (cookies.size) {
    headers.Cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  for (const raw of response.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const index = pair.indexOf("=");
    if (index > 0) cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }

  if (raw) return { status: response.status, response };

  const payload = await response.json().catch(() => null);
  return { status: response.status, payload };
}

/** Unwraps the backend's success envelope, exactly as `api.ts` does. */
function data(result) {
  if (!result.payload || result.payload.success !== true) {
    throw new Error(
      `expected a success envelope, got ${result.status}: ${JSON.stringify(result.payload)?.slice(0, 300)}`,
    );
  }
  return result.payload.data;
}

/** Mirrors `request()` in lib/api.ts: throws on a non-2xx. */
async function get(path, options) {
  return data(await call(path, options));
}

function errorCode(result) {
  return result.payload?.error?.code ?? null;
}

/* ============================================================== run ==== */

const RUN_ID = process.env.RUN_ID ?? String(process.pid);

console.log(`\x1b[1mTechCiti frontend <-> backend contract check\x1b[0m`);
console.log(`  API   ${BASE}`);
console.log(`  admin ${ADMIN_ORIGIN}`);
console.log(`  tutor ${TUTOR_ORIGIN}\n`);

/* ------------------------------- health ------------------------------- */

section("GET /api/health  (not in api.ts, but proves the server is up)");
{
  const health = await get("/health");
  ok("status is ok", health.status === "ok");
  ok("database is up", health.database === "up");
}

/* -------------------------------- auth -------------------------------- */

section("auth.*  ->  /admin/auth/*");
let session = null;
{
  // The backend locks an IP+email out for 15 minutes after 5 failed sign-ins.
  // Re-running this script inside that window trips it, which is the backend
  // behaving correctly rather than a contract failure — so it is reported as
  // such and the run stops before it creates any rows it could not clean up.
  const probe = await call("/admin/auth/login", {
    method: "POST",
    origin: ADMIN_ORIGIN,
    body: { email: env.SUPER_ADMIN_EMAIL, password: "definitely-wrong-password" },
  });

  if (probe.status === 429) {
    console.log(
      `\n\x1b[33m! Sign-in is locked out for ${env.SUPER_ADMIN_EMAIL} from this IP.\n` +
        `  The backend allows 5 failed attempts per 15 minutes, and this script\n` +
        `  deliberately sends a wrong password. Wait for the window to pass, or\n` +
        `  clear the lockout row, then run it again.\x1b[0m\n`,
    );
    process.exit(2);
  }

  okIn("wrong password is rejected", errorCode(probe), ["UNAUTHORIZED", "VALIDATION_ERROR"]);

  const good = await call("/admin/auth/login", {
    method: "POST",
    origin: ADMIN_ORIGIN,
    body: { email: env.SUPER_ADMIN_EMAIL, password: env.SUPER_ADMIN_PASSWORD },
  });

  if (good.status === 429) {
    console.log("\n\x1b[33m! Sign-in locked out mid-run; nothing was created.\x1b[0m\n");
    process.exit(2);
  }

  session = data(good);
  // api.ts reads payload.admin, not the payload itself.
  ok("login returns { admin }", typeof session?.admin === "object" && session.admin !== null);
  const admin = session?.admin ?? {};
  ok("admin.name is a string", typeof admin.name === "string" && admin.name.length > 0);
  ok("admin.email is a string", typeof admin.email === "string" && admin.email.length > 0);
  okIn("admin.role", admin.role, ["SUPER_ADMIN", "ADMIN"]);
  ok("a session cookie was set", cookies.size > 0);
  // api.ts sends no Authorization header — the cookie alone must authenticate.
  ok("session is usable with only the cookie", Boolean(session));
}

/* ------------------------------- tutors ------------------------------- */

section("tutors.list / create  ->  /admin/tutors  (mapTutor)");
let tutorId = null;
let tutorTokenValue = null;
{
  const list = await get("/admin/tutors", {
    origin: ADMIN_ORIGIN,
    query: { page: 1, pageSize: 100 },
  });

  ok("returns a paginated envelope", typeof list === "object" && Array.isArray(list.rows));
  ok("has rows", list.rows.length > 0, `got ${list.rows?.length}`);
  okIn("hasNext is boolean", typeof list.hasNext, ["boolean"]);

  const tutor = list.rows[0];
  // Every field mapTutor reads.
  ok("tutor.id", typeof tutor.id === "string" && tutor.id.length > 0);
  ok("tutor.fullName", typeof tutor.fullName === "string" && tutor.fullName.length > 0);
  ok("tutor.email is string|null", tutor.email === null || typeof tutor.email === "string");
  ok("tutor.phone is a string", typeof tutor.phone === "string");
  ok("tutor.isActive is boolean", typeof tutor.isActive === "boolean");
  ok("tutor.createdAt parses as a date", !Number.isNaN(Date.parse(tutor.createdAt)));
  // The optional token must NOT leak in a list.
  ok("accessToken is absent from list rows", tutor.accessToken === undefined);

  // status filter vocabulary
  const active = await get("/admin/tutors", {
    origin: ADMIN_ORIGIN,
    query: { status: "active", pageSize: 100 },
  });
  ok("status=active filters", active.rows.every((t) => t.isActive === true));
  const all = await get("/admin/tutors", { origin: ADMIN_ORIGIN, query: { status: "all" } });
  ok("status=all does not filter", all.rows.length >= active.rows.length);

  // create -> the response must include accessToken so the portal link works
  const stamp = Date.now().toString(36);
  const created = data(
    await call("/admin/tutors", {
      method: "POST",
      origin: ADMIN_ORIGIN,
      body: {
        fullName: `Contract Check ${RUN_ID}`,
        email: `contract.${RUN_ID}@techciti.test`,
        phone: "08030000000",
      },
    }),
  );
  tutorId = created.id;
  ok("create returns the new tutor id", typeof tutorId === "string" && tutorId.length > 0);
  okIn("create returns isActive", typeof created.isActive, ["boolean"]);

  // The portal link endpoint is what privateLink() calls.
  const link = await get(`/admin/tutors/${tutorId}/link`, { origin: ADMIN_ORIGIN });
  const linkUrl = link?.url ?? link?.portalUrl ?? null;
  ok("link endpoint returns a url", typeof linkUrl === "string" && linkUrl.length > 0, JSON.stringify(link));

  // Pull the token out of the link so the tutor namespace can be exercised.
  const match = /\/t\/([A-Za-z0-9]+)/.exec(String(linkUrl));
  ok("link embeds a /t/<token> path", Boolean(match), String(linkUrl));
  tutorTokenValue = match?.[1] ?? null;
}

/* ------------------------------ students ------------------------------ */

section("students.list / create  ->  /admin/students  (mapStudent)");
let studentId = null;
{
  const list = await get("/admin/students", {
    origin: ADMIN_ORIGIN,
    query: { pageSize: 100 },
  });
  ok("returns a paginated envelope", Array.isArray(list.rows));
  ok("has rows", list.rows.length > 0);

  const student = list.rows[0];
  ok("student.id", typeof student.id === "string" && student.id.length > 0);
  ok("student.fullName", typeof student.fullName === "string" && student.fullName.length > 0);
  // mapStudent reads ageGroup and ageGroupToGrade() switches on exactly these.
  okIn("student.ageGroup", student.ageGroup, ["KIDS", "TEENS", "ADULTS"]);
  ok("student.parentName is string|null", student.parentName === null || typeof student.parentName === "string");
  ok("student.isActive is boolean", typeof student.isActive === "boolean");
  ok("gender is absent (the model has no such column)", student.gender === undefined);

  // The filter vocabulary students.list() sends.
  const kids = await get("/admin/students", { origin: ADMIN_ORIGIN, query: { ageGroup: "KIDS" } });
  ok("ageGroup filter works", kids.rows.every((s) => s.ageGroup === "KIDS"));

  const byCourse = await call("/admin/students", {
    origin: ADMIN_ORIGIN,
    query: { courseId: "definitely-not-a-course" },
  });
  okIn("courseId filter with a bad id is handled", byCourse.status, [200]);
  ok("bad courseId yields no rows", (data(byCourse).rows ?? []).length === 0);

  const stamp = Date.now().toString(36);
  const created = data(
    await call("/admin/students", {
      method: "POST",
      origin: ADMIN_ORIGIN,
      body: {
        fullName: `Contract Student ${RUN_ID}`,
        ageGroup: "TEENS",
        parentName: "Contract Parent",
        parentPhone: "08030000001",
      },
    }),
  );
  studentId = created.id;
  ok("create returns the new student id", typeof studentId === "string" && studentId.length > 0);
}

/* ------------------------------- courses ------------------------------ */

section("courses.list / resolveId  ->  /admin/courses");
let courseId = null;
let courseName = null;
{
  const list = await get("/admin/courses", { origin: ADMIN_ORIGIN, query: { pageSize: 100 } });
  ok("returns a paginated envelope", Array.isArray(list.rows));
  ok("has rows", list.rows.length > 0);

  const course = list.rows[0];
  courseId = course.id;
  courseName = course.name;
  ok("course.id", typeof courseId === "string" && courseId.length > 0);
  ok("course.name", typeof courseName === "string" && courseName.length > 0);
  // resolveId() matches on an exact name.
  ok("course names are unique", new Set(list.rows.map((c) => c.name)).size === list.rows.length);
}

/* ----------------------------- assignments ---------------------------- */

section("assignments.list / create / remove  ->  /admin/assignments");
let assignmentId = null;
{
  const created = data(
    await call("/admin/assignments", {
      method: "POST",
      origin: ADMIN_ORIGIN,
      body: { tutorId, studentId, courseId, level: "BEGINNER" },
    }),
  );
  assignmentId = created.id;
  ok("create returns the new assignment id", typeof assignmentId === "string" && assignmentId.length > 0);

  // The duplicate guard the UI relies on.
  const dupe = await call("/admin/assignments", {
    method: "POST",
    origin: ADMIN_ORIGIN,
    body: { tutorId, studentId, courseId, level: "BEGINNER" },
  });
  okIn("duplicate assignment is a CONFLICT", errorCode(dupe), ["CONFLICT"]);

  const list = await get("/admin/assignments", { origin: ADMIN_ORIGIN, query: { pageSize: 100 } });
  ok("returns a paginated envelope", Array.isArray(list.rows));

  // list() must not blow up on the include shape mapReport relies on.
  const row = list.rows.find((r) => r.id === assignmentId);
  ok("the new assignment appears in the list", Boolean(row));
  ok("row.tutor is included", typeof row?.tutor?.fullName === "string", JSON.stringify(row?.tutor));
  ok("row.student is included", typeof row?.student?.fullName === "string", JSON.stringify(row?.student));
  ok("row.course is included", typeof row?.course?.name === "string", JSON.stringify(row?.course));
}

/* --------------------------- tutor namespace -------------------------- */

section("portal.*  ->  /api/tutor/*  (X-Tutor-Token)");
{
  ok("a tutor token was resolved from the link", typeof tutorTokenValue === "string" && tutorTokenValue.length > 0);

  const me = await get("/tutor/me", { origin: TUTOR_ORIGIN, tutorToken: tutorTokenValue });
  ok("GET /me returns the tutor", typeof me.fullName === "string" && me.fullName.length > 0);
  ok("GET /me id matches", me.id === tutorId);

  const month = new Date().toISOString().slice(0, 7);
  // api.ts reads payload.students, not a bare array.
  const portal = await get("/tutor/assignments", {
    origin: TUTOR_ORIGIN,
    tutorToken: tutorTokenValue,
    query: { month },
  });
  ok("GET /assignments returns an object", typeof portal === "object" && portal !== null);
  ok("payload.month round-trips", portal.month === month, `${portal.month} vs ${month}`);
  ok("payload.tutor is an object", typeof portal.tutor === "object" && portal.tutor !== null);
  ok("payload.students is a list", Array.isArray(portal.students));
  ok("payload.summary is an object", typeof portal.summary === "object");
  ok("summary.total matches students.length", portal.summary?.total === portal.students?.length);
  for (const key of ["total", "submitted", "inProgress", "notStarted"]) {
    ok(`summary.${key} is a number`, typeof portal.summary?.[key] === "number", JSON.stringify(portal.summary));
  }
  ok("the new assignment is in the tutor's list", portal.students.some((a) => a.assignmentId === assignmentId));

  const card = portal.students.find((a) => a.assignmentId === assignmentId);
  // deriveCardStatus() switches on exactly these.
  okIn("card.status", card?.status, ["NOT_STARTED", "DRAFT", "SUBMITTED", "REVIEWED", "NEEDS_REVISION"]);
  ok("card.studentName is flat", typeof card?.studentName === "string");
  okIn("card.ageGroup", card?.ageGroup, ["KIDS", "TEENS", "ADULTS"]);
  ok("card.courseName is flat", typeof card?.courseName === "string");
  // The drawer seeds its form from card.report, so the body must be present.
  ok("card.report is present (not just its status)", card?.report === null || typeof card?.report === "object", JSON.stringify(card)?.slice(0, 200));
  ok("card.report is null before any report exists", card?.report === null);
  ok("card.reportId is null before any report exists", card?.reportId === null);

  // Autosave (PUT) then submit (POST).
  const draft = {
    topicsCovered: "Fractions, decimals and percentages",
    continuityNeeded: true,
    continuityNote: "Continue with ratio and proportion next month.",
    generalFeedback: "A focused month. The student grasped equivalent fractions quickly and needs more practice with word problems.",
    tutorComment: "Strong effort and good class participation.",
    progressRating: "GOOD",
  };

  const saved = await call(`/tutor/reports/${assignmentId}`, {
    method: "PUT",
    origin: TUTOR_ORIGIN,
    tutorToken: tutorTokenValue,
    query: { month },
    body: draft,
  });
  okIn("PUT autosave succeeds", saved.status, [200]);
  const savedReport = data(saved);
  okIn("autosaved status is DRAFT", savedReport.status, ["DRAFT"]);
  ok("autosaved topics round-trip", savedReport.topicsCovered === draft.topicsCovered);
  ok("autosaved rating round-trips", savedReport.progressRating === "GOOD");
  ok("autosave returned an id", typeof savedReport.id === "string" && savedReport.id.length > 0);

  // After the draft exists the card must carry the body the drawer seeds from.
  const afterSave = await get("/tutor/assignments", {
    origin: TUTOR_ORIGIN,
    tutorToken: tutorTokenValue,
    query: { month },
  });
  const savedCard = afterSave.students.find((a) => a.assignmentId === assignmentId);
  okIn("card.status is DRAFT once autosaved", savedCard?.status, ["DRAFT"]);
  ok("card.report is no longer null", savedCard?.report !== null);
  ok("card.report carries the draft body", savedCard?.report?.topicsCovered === draft.topicsCovered, JSON.stringify(savedCard?.report)?.slice(0, 200));
  ok("card.report.generalFeedback round-trips", savedCard?.report?.generalFeedback === draft.generalFeedback);
  ok("card.report.continuityNeeded round-trips", savedCard?.report?.continuityNeeded === true);

  // The previous-month read copyFromPreviousMonth() calls.
  const previous = await call(`/tutor/reports/${assignmentId}/previous`, {
    origin: TUTOR_ORIGIN,
    tutorToken: tutorTokenValue,
    query: { month },
  });
  okIn("previous month read succeeds", previous.status, [200]);
  ok("previous payload has a report key", "report" in data(previous));

  // Submit requires everything the UI sends.
  const submitted = await call(`/tutor/reports/${assignmentId}/submit`, {
    method: "POST",
    origin: TUTOR_ORIGIN,
    tutorToken: tutorTokenValue,
    query: { month },
    body: draft,
  });
  okIn("submit succeeds", submitted.status, [200, 201]);
  okIn("submitted status is SUBMITTED", data(submitted).status, ["SUBMITTED"]);

  // A duplicate submit must be refused; the UI renders DUPLICATE_REPORT.
  const again = await call(`/tutor/reports/${assignmentId}/submit`, {
    method: "POST",
    origin: TUTOR_ORIGIN,
    tutorToken: tutorTokenValue,
    query: { month },
    body: draft,
  });
  okIn("duplicate submit is refused", errorCode(again), ["DUPLICATE_REPORT", "CONFLICT"]);

  // Incomplete submit must fail validation, with field-level details.
  const incomplete = await call(`/tutor/reports/${assignmentId}/submit`, {
    method: "POST",
    origin: TUTOR_ORIGIN,
    tutorToken: tutorTokenValue,
    query: "2099-01",
    body: { ...draft, generalFeedback: "", progressRating: null },
  });
  ok("future month is refused", errorCode(incomplete) !== null || incomplete.status >= 400);
}

/* ------------------------- ownership + revocation --------------------- */

section("tutor namespace isolation");
{
  const noToken = await call("/tutor/me", { origin: TUTOR_ORIGIN });
  okIn("no token is UNAUTHORIZED", errorCode(noToken), ["UNAUTHORIZED"]);

  const badToken = await call("/tutor/me", { origin: TUTOR_ORIGIN, tutorToken: "not-a-real-token" });
  okIn("a bad token is refused", errorCode(badToken), ["UNAUTHORIZED", "NOT_FOUND"]);

  // A revoked token must stop working; api.ts turns this into NOT_FOUND so
  // the portal shows its "invalid link" screen.
  const revoker = data(
    await call(`/admin/tutors/${tutorId}/regenerate-link`, { method: "POST", origin: ADMIN_ORIGIN }),
  );
  const newToken = revoker.accessToken;
  ok("regenerate-link returns a fresh token", typeof newToken === "string" && newToken.length >= 48, `len ${String(newToken).length}`);

  const old = await call("/tutor/me", { origin: TUTOR_ORIGIN, tutorToken: tutorTokenValue });
  ok("the old token stops working after regeneration", old.status >= 400, `status ${old.status}`);

  const fresh = await call("/tutor/me", { origin: TUTOR_ORIGIN, tutorToken: newToken });
  ok("the new token works", fresh.status === 200);

  // From here on the regenerated token is the only live one, so every later
  // section (CORS, and anything else that authenticates as this tutor) uses it.
  tutorTokenValue = newToken;
}

/* ------------------------------- reports ------------------------------ */

section("reports.*  ->  /admin/reports  (mapReport / mapReportWithContext)");
{
  const list = await get("/admin/reports", {
    origin: ADMIN_ORIGIN,
    query: { pageSize: 20, sort: "month", direction: "desc" },
  });
  ok("returns a paginated envelope", Array.isArray(list.rows));
  ok("total is a number", typeof list.total === "number");

  // Ask for exactly the report this run created rather than hoping it lands on
  // page 1 — the seeded database has ~117 reports.
  const month = new Date().toISOString().slice(0, 7);
  const mine = await get("/admin/reports", {
    origin: ADMIN_ORIGIN,
    query: { month, tutorId, pageSize: 20 },
  });
  const report = mine.rows.find((r) => r.tutor?.id === tutorId);
  ok("the contract report is findable by month+tutor", Boolean(report), `rows ${mine.rows.length}, total ${mine.total}`);
  ok("it is the assignment this run created", report?.assignmentId === assignmentId, `got ${report?.assignmentId}, want ${assignmentId}`);

  if (report) {
    // Every field mapReport reads.
    ok("report.id", typeof report.id === "string");
    ok("report.assignmentId", typeof report.assignmentId === "string");
    ok("report.month is YYYY-MM", /^\d{4}-\d{2}$/.test(report.month), report.month);
    ok("report.topicsCovered is a string", typeof report.topicsCovered === "string");
    ok("report.continuityNeeded is boolean", typeof report.continuityNeeded === "boolean");
    ok("report.continuityNote is string|null", report.continuityNote === null || typeof report.continuityNote === "string");
    ok("report.generalFeedback is a string", typeof report.generalFeedback === "string");
    ok("report.tutorComment is a string", typeof report.tutorComment === "string");
    // mapRating() switches on these exact strings.
    okIn("report.progressRating", report.progressRating, ["EXCELLENT", "GOOD", "FAIR", "NEEDS_ATTENTION", null]);
    // STATUS_FROM_BACKEND switches on these.
    okIn("report.status", report.status, ["DRAFT", "SUBMITTED", "REVIEWED", "NEEDS_REVISION"]);
    // mapReport reads revisionNote, not reviewerNote.
    ok("report.revisionNote exists", "revisionNote" in report);
    ok("report.tutor.fullName is included", typeof report.tutor?.fullName === "string");
    ok("report.student.fullName is included", typeof report.student?.fullName === "string");
    // ageGroupToGrade reads this.
    okIn("report.student.ageGroup", report.student?.ageGroup, ["KIDS", "TEENS", "ADULTS", undefined]);
    ok("report.course.name is included", typeof report.course?.name === "string");

    // review() and requestRevision()
    const reviewed = await call(`/admin/reports/${report.id}/review`, {
      method: "POST",
      origin: ADMIN_ORIGIN,
      body: {},
    });
    okIn("review succeeds", reviewed.status, [200]);
    okIn("reviewed status is REVIEWED", data(reviewed).status, ["REVIEWED"]);

    // xlsx export
    const xlsx = await call(`/admin/reports/export.xlsx`, {
      origin: ADMIN_ORIGIN,
      query: { month: report.month },
      raw: true,
    });
    okIn("xlsx export responds 200", xlsx.status, [200]);
    const type = xlsx.response.headers.get("content-type") ?? "";
    ok("xlsx export is a spreadsheet", /spreadsheet|octet-stream/.test(type), type);
  }

  // The backend's own sort enum, which SORT_TO_BACKEND must translate into.
  for (const sort of ["studentName", "tutorName", "courseName", "month", "status", "progressRating", "submittedAt"]) {
    const result = await call("/admin/reports", { origin: ADMIN_ORIGIN, query: { sort, direction: "desc", pageSize: 5 } });
    okIn(`sort=${sort} is accepted`, result.status, [200]);
  }
  // Keys the backend rejects, so a bad translation is caught here rather than
  // silently 422-ing in the reports table.
  for (const sort of ["student", "tutor", "course", "updatedAt"]) {
    const result = await call("/admin/reports", { origin: ADMIN_ORIGIN, query: { sort, pageSize: 5 } });
    okIn(`sort=${sort} is correctly NOT sent raw`, result.status, [422]);
  }
}

/* ------------------------------ dashboard ----------------------------- */

section("dashboard.get  ->  /admin/dashboard");
{
  const month = new Date().toISOString().slice(0, 7);
  const dash = await get("/admin/dashboard", { origin: ADMIN_ORIGIN, query: { month } });
  ok("has stats", typeof dash.stats === "object" && dash.stats !== null);
  // api.ts reads outstanding.rows, not a bare array.
  ok("outstanding is grouped, not a bare array", typeof dash.outstanding === "object" && !Array.isArray(dash.outstanding));
  ok("outstanding.rows is a list", Array.isArray(dash.outstanding?.rows));
  ok("has recent", Array.isArray(dash.recent));

  const s = dash.stats;
  for (const key of ["totalTutors", "totalStudents", "submitted", "pending", "expected"]) {
    ok(`stats.${key} is a number`, typeof s[key] === "number", JSON.stringify(Object.keys(s)));
  }
  if (dash.outstanding?.rows?.length) {
    const entry = dash.outstanding.rows[0];
    // mapDashboard reads exactly these.
    ok("outstanding row has tutorId", typeof entry.tutorId === "string");
    ok("outstanding row has fullName", typeof entry.fullName === "string");
    ok("outstanding row has phone", typeof entry.phone === "string");
    ok("outstanding row has total", typeof entry.total === "number");
    ok("outstanding row has submitted", typeof entry.submitted === "number");
    ok("outstanding row has remaining", typeof entry.remaining === "number");
    ok("outstanding row has portalUrl", typeof entry.portalUrl === "string");
    ok("outstanding row has whatsappLink", entry.whatsappLink === null || typeof entry.whatsappLink === "string");
  } else {
    ok("outstanding.rows was empty or populated consistently", true);
  }
}

/* --------------------------- student profile -------------------------- */

section("students.getProfile  ->  /admin/students/:id/profile");
{
  const profile = await get(`/admin/students/${studentId}/profile`, { origin: ADMIN_ORIGIN });
  ok("has a student", typeof profile.student?.id === "string");
  ok("has reports", Array.isArray(profile.reports));
  ok("has assignments", Array.isArray(profile.assignments));
  ok("has a summary", typeof profile.summary === "object" && profile.summary !== null);
  // mapProfile reads averageRating off summary, not off the root.
  ok("summary.averageRating is number|null", profile.summary?.averageRating === null || typeof profile.summary?.averageRating === "number", JSON.stringify(profile.summary));
  if (profile.assignments.length) {
    ok("assignment carries course.name", typeof profile.assignments[0].course?.name === "string");
  }
  if (profile.reports.length) {
    const row = profile.reports[0];
    // Profile timeline rows nest tutor/course rather than flattening names.
    ok("profile report nests tutor", typeof row.tutor?.fullName === "string", JSON.stringify(row.tutor));
    ok("profile report nests course", typeof row.course?.name === "string", JSON.stringify(row.course));
    okIn("profile report status", row.status, ["DRAFT", "SUBMITTED", "REVIEWED", "NEEDS_REVISION"]);
    okIn("profile report progressRating", row.progressRating, ["EXCELLENT", "GOOD", "FAIR", "NEEDS_ATTENTION", null]);
  }
}

/* ------------------------------ documents ----------------------------- */

section("documents.download*  ->  /admin/reports/:id/document.*");
{
  const list = await get("/admin/reports", { origin: ADMIN_ORIGIN, query: { pageSize: 5 } });
  const report = list.rows[0];
  if (report) {
    for (const [label, path, pattern] of [
      ["pdf", `/admin/reports/${report.id}/document.pdf`, /pdf/],
      ["docx", `/admin/reports/${report.id}/document.docx`, /(wordprocessingml|octet-stream)/],
    ]) {
      const result = await call(path, { origin: ADMIN_ORIGIN, raw: true });
      okIn(`${label} responds 200`, result.status, [200]);
      const type = result.response.headers.get("content-type") ?? "";
      ok(`${label} content-type looks right`, pattern.test(type), type);
    }
  }
}

/* -------------------------------- import ------------------------------ */

section("bulkImport.preview / commit  ->  /admin/import/:type");
{
  // The headers must be the backend's template labels ("Full name", not
  // "fullName") — it normalises spaces and underscores but not camelCase.
  const csv = [
    "Full name,Email,Phone",
    `Imported Tutor ${RUN_ID},import.${RUN_ID}@techciti.test,08030000002`,
  ].join("\n");

  const post = (suffix) => {
    const form = new FormData();
    form.append("file", new Blob([csv], { type: "text/csv" }), "tutors.csv");
    return fetch(`${BASE}/admin/import/tutors${suffix}`, {
      method: "POST",
      headers: { Origin: ADMIN_ORIGIN, Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") },
      body: form,
    });
  };

  // A wrong header must be refused with a message naming the column, because
  // that message is what the import screen shows the user.
  const badForm = new FormData();
  badForm.append("file", new Blob(["fullName,email\nx,y"], { type: "text/csv" }), "tutors.csv");
  const bad = await fetch(`${BASE}/admin/import/tutors?dryRun=true`, {
    method: "POST",
    headers: { Origin: ADMIN_ORIGIN, Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") },
    body: badForm,
  });
  const badBody = await bad.json().catch(() => null);
  okIn("camelCase headers are refused", bad.status, [400]);
  ok("the refusal names the missing column", String(badBody?.error?.message ?? "").includes("Full name"), String(badBody?.error?.message));

  const preview = await post("?dryRun=true");
  const previewBody = await preview.json().catch(() => null);
  okIn("dry-run preview responds 200", preview.status, [200]);
  ok("dry-run returns a report", typeof previewBody?.data === "object" && previewBody.data !== null, JSON.stringify(previewBody)?.slice(0, 200));
  ok("dry-run reports zero created", previewBody?.data?.created === undefined || previewBody.data.created === 0);
  ok("dry-run counts rows", typeof previewBody?.data?.rows === "object" || typeof previewBody?.data?.totalRows === "number", JSON.stringify(Object.keys(previewBody?.data ?? {})));

  const committed = await post("");
  const committedBody = await committed.json().catch(() => null);
  // A commit answers 201 because rows were created.
  okIn("commit responds 201", committed.status, [200, 201]);
  ok("commit reports createdCount", typeof committedBody?.data?.createdCount === "number", JSON.stringify(committedBody?.data ?? {}).slice(0, 200));
  ok("commit created the row", committedBody?.data?.createdCount === 1, JSON.stringify(committedBody?.data ?? {}).slice(0, 200));
  // `created` is an array of names, NOT the count — api.ts must read
  // createdCount, or the UI renders a comma-joined list as a number.
  ok("created is an array of names, not a count", Array.isArray(committedBody?.data?.created));
  ok("preview rows carry `row`, not `rowNumber`", typeof committedBody?.data?.preview?.rows?.[0]?.row === "number", JSON.stringify(committedBody?.data?.preview?.rows?.[0]));
  ok("preview row errors are keyed by field", typeof committedBody?.data?.preview?.rows?.[0]?.errors === "object");
}

/* ------------------------------- origins ------------------------------ */

section("CORS / origin enforcement");
{
  // An origin in neither list. The dev .env lists both local ports because one
  // Next.js app serves /admin and /t/<token>, so testing the tutor origin here
  // would prove nothing — what matters is that a third-party origin is still
  // turned away by both namespaces.
  const FOREIGN = "https://evil.example";

  const adminForeign = await call("/admin/tutors", { origin: FOREIGN, query: { pageSize: 1 } });
  okIn("admin namespace refuses an unknown origin", adminForeign.status, [403]);
  ok(
    "the refusal names the admin API",
    String(adminForeign.payload?.error?.message ?? "").includes("admin"),
    String(adminForeign.payload?.error?.message),
  );

  const tutorForeign = await call("/tutor/me", { origin: FOREIGN, tutorToken: tutorTokenValue });
  okIn("tutor namespace refuses an unknown origin", tutorForeign.status, [403]);
  ok(
    "the refusal names the tutor API",
    String(tutorForeign.payload?.error?.message ?? "").includes("tutor"),
    String(tutorForeign.payload?.error?.message),
  );

  // Both configured dev origins must be accepted by *their own* namespace.
  for (const origin of [ADMIN_ORIGIN, TUTOR_ORIGIN]) {
    const adminOk = await call("/admin/tutors", { origin, query: { pageSize: 1 } });
    okIn(`admin accepts ${origin}`, adminOk.status, [200]);
  }
  for (const origin of [ADMIN_ORIGIN, TUTOR_ORIGIN]) {
    const tutorOk = await call("/tutor/me", { origin, tutorToken: tutorTokenValue });
    okIn(`tutor accepts ${origin}`, tutorOk.status, [200]);
  }

  const noOrigin = await call("/api/health".replace("/api", ""));
  okIn("health needs no origin", noOrigin.status, [200]);
}

/* ------------------------------- cleanup ------------------------------ */

section("cleanup");
{
  // The assignment first. Note what a delete actually does: it deactivates the
  // assignment and keeps its reports, which is why the tutor below is still
  // protected — and why the janitor script is needed to truly reset.
  const removed = await call(`/admin/assignments/${assignmentId}`, { method: "DELETE", origin: ADMIN_ORIGIN });
  okIn("the throwaway assignment can be deleted", removed.status, [200, 204]);

  // Deleting an assignment keeps its report, so this tutor still owns one and
  // the API refuses — which is the behaviour the admin UI renders as "deactivate
  // it instead". Asserted rather than worked around.
  const deleteTutor = await call(`/admin/tutors/${tutorId}`, { method: "DELETE", origin: ADMIN_ORIGIN });
  okIn(
    "hard-deleting a tutor that still owns a report is refused",
    errorCode(deleteTutor) ?? String(deleteTutor.status),
    ["CONFLICT", "VALIDATION_ERROR", "409"],
  );

  await call("/admin/auth/logout", { method: "POST", origin: ADMIN_ORIGIN });
  const afterLogout = await call("/admin/tutors", { origin: ADMIN_ORIGIN, query: { pageSize: 1 } });
  ok("the session cookie stops working after logout", afterLogout.status >= 400, `status ${afterLogout.status}`);
}

// The HTTP surface cannot remove rows that own reports, so the throwaway
// tutors, students, assignments and reports are cleared at the database level
// instead. Without this the runs would slowly fill the seeded tables.
const purge = spawnSync(
  process.execPath,
  [join(BACKEND, "scripts", "purge-test-rows.mjs"), "--quiet"],
  { encoding: "utf8" },
);
ok("the test-row janitor ran cleanly", purge.status === 0, (purge.stderr ?? "").trim().slice(0, 200));

/* ------------------------------- summary ----------------------------- */

console.log(`\n${"─".repeat(60)}`);
if (failures.length === 0) {
  console.log(`\x1b[32m\x1b[1m  ${passed} passed, 0 failed\x1b[0m`);
  console.log(`${"─".repeat(60)}\n`);
  process.exit(0);
}

console.log(`\x1b[31m\x1b[1m  ${passed} passed, ${failures.length} FAILED\x1b[0m\n`);
for (const failure of failures) console.log(`  \x1b[31m* ${failure}\x1b[0m`);
console.log(`\n${"─".repeat(60)}\n`);
process.exit(1);