/* ------------------------------------------------------------------ *
 * CORS preflight probe.
 *
 * Node's fetch never performs a preflight, so `contract-check.mjs` proves
 * that requests with an Origin header are accepted while leaving the one
 * thing a real browser does before every cross-origin POST untested.
 *
 * A browser sends OPTIONS with Access-Control-Request-Method/Headers; if
 * the server does not answer with the right Allow-Origin, Allow-Methods
 * and Allow-Headers, the actual request is never sent at all. That is the
 * single most likely way the live integration breaks in a way no server-
 * side test can see.
 *
 *   node scripts/preflight-check.mjs
 * ------------------------------------------------------------------ */

const API = process.env.API_BASE ?? "http://localhost:4000";
const ORIGIN = process.env.ORIGIN ?? "http://localhost:3001";

const CASES = [
  { name: "admin GET   /api/admin/tutors", path: "/api/admin/tutors", method: "GET" },
  { name: "admin POST  /api/admin/auth/login", path: "/api/admin/auth/login", method: "POST" },
  { name: "admin POST  multipart import", path: "/api/admin/import/tutors", method: "POST" },
  { name: "tutor GET   /api/tutor/me", path: "/api/tutor/me", method: "GET" },
  { name: "tutor PUT   /api/tutor/reports/:id", path: "/api/tutor/reports/probe", method: "PUT" },
  { name: "foreign     /api/admin/tutors", path: "/api/admin/tutors", method: "GET", origin: "https://evil.example" },
];

let passed = 0;
const failures = [];

const results = await Promise.all(
  CASES.map(async (c) => {
    const res = await fetch(`${API}${c.path}`, {
      method: "OPTIONS",
      headers: {
        Origin: c.origin ?? ORIGIN,
        "Access-Control-Request-Method": c.method,
        "Access-Control-Request-Headers": "content-type, x-tutor-token",
      },
    });
    return { c, res, allowOrigin: res.headers.get("access-control-allow-origin") };
  }),
);

for (const { c, res, allowOrigin } of results) {
  const foreign = Boolean(c.origin);
  const label = c.name;

  const expectRejected = foreign;
  const rejected = allowOrigin === null || allowOrigin === "false";

  const ok = expectRejected ? rejected : !rejected;
  if (ok) passed += 1;
  else failures.push(`${label} -> allow-origin=${allowOrigin}`);

  console.log(
    `  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"} ${label}` +
      `  status=${res.status} allow-origin=${allowOrigin ?? "(none)"}`,
  );

  if (!expectRejected && ok) {
    const headers = (res.headers.get("access-control-allow-headers") ?? "").toLowerCase();
    const methods = (res.headers.get("access-control-allow-methods") ?? "").toUpperCase();
    const wantHeaders = ["content-type", "x-tutor-token"];
    const wantMethods = [c.method];

    for (const h of wantHeaders) {
      const got = headers.includes(h);
      if (got) passed += 1;
      else failures.push(`${label} -> Allow-Headers missing ${h}`);
      console.log(`    ${got ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"} Allow-Headers contains ${h}`);
    }
    for (const m of wantMethods) {
      const got = methods.includes(m);
      if (got) passed += 1;
      else failures.push(`${label} -> Allow-Methods missing ${m}`);
      console.log(`    ${got ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"} Allow-Methods contains ${m}`);
    }
    const creds = res.headers.get("access-control-allow-credentials");
    const gotCreds = creds === "true";
    if (gotCreds) passed += 1;
    else failures.push(`${label} -> Allow-Credentials not true (session cookie would be dropped)`);
    console.log(`    ${gotCreds ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"} Allow-Credentials is true`);
  }
}

console.log(`\n${"─".repeat(60)}`);
if (failures.length === 0) {
  console.log(`\x1b[32m\x1b[1m  ${passed} passed, 0 failed\x1b[0m`);
  console.log(`${"─".repeat(60)}\n`);
  process.exit(0);
}
console.log(`\x1b[31m\x1b[1m  ${passed} passed, ${failures.length} FAILED\x1b[0m\n`);
for (const f of failures) console.log(`  \x1b[31m* ${f}\x1b[0m`);
console.log(`\n${"─".repeat(60)}\n`);
process.exit(1);
