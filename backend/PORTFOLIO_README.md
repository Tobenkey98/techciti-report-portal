🚀 DEVELOPER PORTFOLIO ASSET
Engineered, Tested, and Maintained independently.

This repository demonstrates standard enterprise architecture, clean code practices, and modern deployment strategies.

---

# TechCiti Tutor Report Portal — Backend API

Production-grade REST API powering a two-audience monthly reporting workflow: tutors
submit student progress reports from phones, admins review and publish them. Built
independently as the complete server for an existing frontend.

| | |
| --- | --- |
| **Type** | REST API — Node.js + Express + TypeScript (ESM) |
| **Stack** | Express 4, TypeScript 5.7, Prisma 6, MySQL/MariaDB, Zod, JWT |
| **Endpoints** | 62 across 9 route modules |
| **Test suite** | 89 automated end-to-end assertions, self-cleaning and re-runnable |
| **Verification** | Typecheck clean · build clean · suite green against dev *and* compiled runtimes |

---

## 📖 Project Overview & Motivation

### The problem

TechCiti runs a tutoring operation where every tutor files a written progress report
for every assigned student, every month. The workflow is deceptively fiddly:

- **Two audiences, two threat models.** Tutors are external users opening a link on
  a phone — no accounts, no passwords. Admins are staff on a desktop. Conflating them
  in one auth system would mean either exposing staff endpoints to token-less clients
  or forcing tutors through a signup flow they cannot complete.
- **Reports are immutable once filed.** A submitted report is a record that parents
  and management rely on. "Editing" one silently is unacceptable; it needs an explicit
  reopen path with an audit trail.
- **Bulk data entry.** Tutors, students, and the assignment matrix all arrive in
  spreadsheets. Hand-keying is where data quality dies.
- **Document generation.** A reviewed report must leave the system as a branded PDF,
  Word document, or spreadsheet — server-side, without the browser doing layout.

### The architectural decision

The central choice was to treat **authentication strategy as a function of the
audience**, not of the route. This produces two independent auth systems behind one
process:

| | Admin portal | Tutor portal |
| --- | --- | --- |
| Credential | Email + password | 48-hex access token in URL path |
| Transport | `httpOnly` `Secure` `SameSite=Strict` cookie | `X-Tutor-Token` header |
| Lifetime | 8h JWT | Revocable, per-tutor, no expiry |
| Origin | `ADMIN_ORIGIN` only | `TUTOR_ORIGIN` only |
| Identity | Database row, re-checked per request | Database row, re-checked per request |

This is why the tutor portal can be a bare `/t/[token]` link with no login screen —
the token *is* the identity — while admin sessions remain unreachable from it.

### The engineering problem that mattered most

The hard requirement wasn't the endpoints; it was **proving the isolation actually
holds**. A tutor holding a valid token must not be able to read, write, or infer
anything outside their own assignments. That guarantee is enforced in the data layer
rather than the handler layer — every tutor query is scoped by a `tutorId` resolved
from the request, and foreign resources return `404` rather than `403` so the API
never confirms that someone else's record exists.

The result: `scripts/smoke.mjs` asserts cross-tenant access returns `404`, that
ownership is enforced on assignment *and* report lookups, and that a revoked token
stops working immediately — then deletes everything it created.

---

## 🛠️ System Architecture & Tech Stack

### Request lifecycle

```
                      ┌──────────────────────────────────────────┐
   Tutor's phone      │              Express Pipeline            │
   /t/[token]  ──────▶│                                             │
                      │  helmet · cookie-parser · pino-http      │
                      │  JSON body parser (size-capped, 1 MB)  │
                      └────────────────────┬───────────────────────┘
                                           │
              ┌────────────────────────────┴────────────────────────────┐
              │  per-namespace mount (CORS + origin + rate limit)       │
              └────────────────────────────┬────────────────────────────┘
                                           │
                          ┌────────────────▼─────────────────┐
                          │      enforceOrigin (403)        │
                          │  /api/admin/* ← ADMIN_ORIGIN     │
                          │  /api/tutor/* ← TUTOR_ORIGIN     │
                          │  apiLimiter 300/min, IPv6-aware  │
                          └────────────────┬─────────────────┘
                                           │
              ┌────────────────────────────┴────────────────────────────┐
              │                                                         │
   ┌──────────▼───────────┐                              ┌──────────────▼──────────────┐
   │   /api/tutor/*       │                              │      /api/admin/*           │
   │                      │                              │                             │
   │ X-Tutor-Token        │                              │ JWT cookie ─▶ verify ─▶ row  │
   │   └─▶ lookup token   │                              │                             │
   │   └─▶ reject if      │                              │  requireAdmin (401/403)     │
   │      revoked/inactive│                              │  SUPER_ADMIN gate on /admins│
   │   └─▶ attach tutorId │                              │                             │
   │                      │                              │  9 sub-routers mounted      │
   │ EVERY query scoped   │                              │  auth · dashboard · admins  │
   │ by that tutorId      │                              │  tutors · students ·        │
   │                      │                              │  courses · assignments ·    │
   │ Foreign row → 404    │                              │  reports · import           │
   └──────────┬───────────┘                              └──────────────┬──────────────┘
              │                                                         │
              └────────────────────────┬────────────────────────────────┘
                                       │
                        ┌──────────────▼───────────────┐
                        │      Zod schema validation   │
                        │  (body · query · params)     │
                        │  → 422 with per-field errors │
                        └──────────────┬───────────────┘
                                       │
                        ┌──────────────▼───────────────┐
                        │      Service layer           │
                        │  ownership · editability ·   │
                        │  state machine · month gate  │
                        └──────────────┬───────────────┘
                                       │
                        ┌──────────────▼───────────────┐
                        │      Prisma ORM              │
                        │  P2002→409 P2003→409         │
                        │  P2025→404                   │
                        └──────────────┬───────────────┘
                                       │
                        ┌──────────────▼───────────────┐
                        │   MySQL / MariaDB            │
                        │  InnoDB · utf8mb4            │
                        │  7 tables · 5 FKs ·          │
                        │  compound unique indexes     │
                        └──────────────┬───────────────┘
                                       │
                        ┌──────────────▼───────────────┐
                        │  activity_logs (JSON meta)   │
                        │  written on every mutation   │
                        └──────────────────────────────┘
```

### Error envelope

Every response — success or failure — uses one shape, so the frontend never guesses.

```jsonc
// success
{ "success": true, "data": { /* resource or list */ } }

// list (paginated)
{ "success": true, "data": {
    "rows": [], "total": 96, "page": 1, "pageSize": 25,
    "pageCount": 4, "hasNext": true, "hasPrevious": false } }

// failure
{ "success": false, "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields need attention.",
    "details": [ { "field": "progressRating", "message": "Required" } ] } }
```

`ErrorCode` maps to HTTP status in one table. Handlers throw `ApiError`; a single
`asyncHandler` wrapper and one error middleware translate everything — including
Prisma's error codes — into the envelope. No handler formats its own error.

### Technology choices worth defending

| Choice | Alternative rejected | Why |
| --- | --- | --- |
| `bcryptjs` | `bcrypt` | Pure JS. Identical API, no node-gyp toolchain — the difference between `npm install` working on a Windows dev box and not. |
| No `dotenv` | `dotenv` | Node 20's `process.loadEnvFile()` plus a small parser fallback. One less dependency for a solved problem. |
| Prisma over raw SQL | Knex / TypeORM | Real foreign keys, compound unique constraints as first-class schema, and type inference that survives refactors. |
| Zod | Joi / class-validator | Schema *is* the type. `z.infer` flows from validator to service to response with no drift. |
| Pino | Winston | ~5× faster, structured JSON out of the box, child loggers per request. |
| Puppeteer as `optionalDependency` | Hard dependency | Chromium download breaks installs on locked-down machines. Made optional; PDF resolves a system Chrome/Edge and fails with an actionable message. |

---

## ⚙️ Core Features Implemented

### 🔒 Security, Routing & Data Management

**Two isolated auth systems.** Admin sessions are 8-hour JWTs in `httpOnly`,
`Secure`, `SameSite=Strict` cookies — unreadable by JavaScript, immune to CSRF.
Tutor identity comes from a 48-hex `crypto.randomBytes` token in the `X-Tutor-Token`
header, resolved to a row on **every single request**. There is no "logged in tutor"
state to go stale.

**Credential revocation that actually works.** `tokenRevokedAt` plus in-place token
regeneration: revoking destroys the token outright (the old value no longer exists in
the table), so it is dead everywhere at once — not just on the next request somewhere.

**Origin enforcement, not just CORS.** CORS is a browser convenience, not a security
boundary, so `enforceOrigin` independently rejects cross-origin requests to the wrong
namespace with `403`. Misconfigured origins fail loudly instead of silently.

**Login throttling.** 5 attempts per IP+email per 15 minutes, tracked in-process. A
distributed deployment would move this to Redis; the interface is already isolated for it.

**Ownership enforced in the query, not the handler.** Foreign assignments return
`404`, never `403` — the API does not confirm the existence of records a tutor
cannot see.

**History-preserving deletes.** Any tutor, student, course, or assignment that owns
reports cannot be hard-deleted. The API returns `409` naming the count and pointing
at deactivation instead. Deactivation is reversible; silent deletion is not.

**Report lifecycle state machine.**

```
        ┌──────────┐   save/submit    ┌────────────┐   submit    ┌───────────┐
        │  DRAFT   │ ────────────────▶ │ SUBMITTED  │ ──────────▶ │ REVIEWED  │
        └──────────┘                   └────────────┘             └───────────┘
              ▲                               │                        │
              │                    request revision                  │
              └───────────────────────────────┴────────────────────────┘

   Editable: DRAFT, NEEDS_REVISION   ·   Locked: SUBMITTED, REVIEWED
   Gate:     no report may be filed for a month that has not started
```

`resolveMonth` is the single source of truth for the future-month rule — one
implementation, one place to audit.

**Nested tenancy.** `/admins` requires `SUPER_ADMIN`; every other admin route
requires an authenticated admin. Verified by the suite, not assumed.

### ⚡ Process Automation & Performance Optimization

**Two-step bulk import with a real dry run.** `POST /import/{tutors|students|assignments}`
accepts CSV or XLSX, supports `?dryRun=true`, and returns a row-by-row preview of
what *would* change — created, updated, skipped, or rejected with the reason. The
admin corrects and re-uploads instead of discovering problems after the fact.
`GET /import/template/:type` emits a pre-formatted XLSX with the exact required
columns, so the happy path is "download, fill in, upload".

**In-memory parsing, never disk.** Uploads are size-capped (5 MB default), validated
by extension, held as a single buffer, and parsed in-process. No temp files, no
cleanup path to get wrong, no path-traversal surface.

**Document generation without layout in the browser.** Reviewed reports render to
PDF (HTML → headless Chrome), Word (`docx`), and Excel (`exceljs`) server-side. PDF
resolution walks `PUPPETEER_EXECUTABLE_PATH` then well-known Chrome/Edge locations,
failing with a message that says exactly what to install.

**Share links built server-side.** Tutor portal URLs are composed centrally so the
admin app never hardcodes a tutor-app host — supporting genuinely separate deployments.
A `wa.me` variant is returned for WhatsApp distribution.

**Batched reads instead of N+1.** List endpoints resolve related counts in two
queries, not one per row. Report counts across tutors and students use grouped
queries rather than per-record lookups.

**Audit trail.** Every mutation writes an `activity_logs` row with JSON metadata —
who, what, when — so "who reopened this report" is answerable after the fact.

### 📊 Testing & Technical Verification

`scripts/smoke.mjs` is a dependency-free end-to-end suite driving the real HTTP API.
89 assertions across auth, both namespaces, the report lifecycle, bulk import,
document generation, role separation, and error semantics.

```bash
npm run dev              # terminal 1
node scripts/smoke.mjs   # terminal 2
```

**The suite is genuinely re-runnable** — this took deliberate work, because the API
correctly refuses to hard-delete anything owning reports. Each run creates its own
throwaway tutor, student, and assignment with a per-run unique suffix, exercises the
full write flow on a fresh assignment (a month can only be submitted once), then
deactivates or removes exactly what it created.

| Area | Assertions |
| --- | --- |
| Health & envelope | Status shape, database reachability, uptime |
| Admin auth | Login, session cookie flags, `me`, logout, post-logout `401`, wrong password |
| Login throttling | Lockout after repeated failures |
| Tutor namespace | Token resolution, revoked token, inactive tutor, `404` for foreign assignments |
| Report lifecycle | Autosave upsert, draft → submitted → reviewed, required-field `422`s, future-month `400`, duplicate `409`, post-submit lockout `403`, `409` on reviewed |
| Admin CRUD | Tutors, students, courses, assignments — including duplicate `409` and invalid level `422` |
| Bulk import | Template download, dry-run preview, commit, wrong-column `400`, missing file `400` |
| Role separation | `SUPER_ADMIN` reaches `/admins` |
| Documents | PDF, Word, Excel generation |
| Cleanup | Every created record removed; session closed |

**Bugs this suite actually caught and fixed** — each a real defect, not a test artifact:

1. `regenerateLink` revoked the token it had just issued, locking the tutor out.
2. Reactivating a tutor never cleared `tokenRevokedAt` — permanently dead portal.
3. `resolveMonth`'s future-month comparisons were inverted, so the guard fell through
   to a confusing `409` instead of the intended `400`.
4. The import rate limiter (10/min) 429'd a legitimate
   preview → correct → commit → second-file session. Raised to 30/min.
5. **The seed was inflating the database on every run.** `pick(LEVELS)` ran only on
   the create branch, so a partly-populated database advanced the shared PRNG by a
   different amount, reshuffling every subsequent tutor's students and cascading into
   new assignments and new reports — 96 → 174 → 240 reports, forever. Fixed by
   hashing row ids for structural decisions, decoupling the board from PRNG position.
   Re-runs now report `0 created` with totals frozen.

Verification matrix — the suite passes against **both** runtimes, so the built
artifact is proven runnable and not merely the dev path:

| Check | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |
| `scripts/smoke.mjs` vs `tsx` dev server | 89/89 |
| `scripts/smoke.mjs` vs compiled `dist/server.js` | 89/89 |
| Seed idempotency (3 consecutive re-runs) | `0 created`, totals frozen |
| `database/schema.sql` → scratch database import | 7 tables, 5 FKs, executes clean |

`npm audit --omit=dev` findings were worked down from 15 to 14 by upgrading
`multer` (1.4.5-lts.2 → 2.4.0) and `csv-parse` (5.6.0 → 7.0.3). The two that remain
are documented with reasoning rather than papered over — see *Known Limitations*.

### 📦 Local Setup & Deployment Specifications

**Requirements:** Node.js ≥ 20, MySQL 8 or MariaDB 10.4+ (XAMPP is fine).

```bash
git clone <repo-url>
cd backend
npm install
cp .env.example .env        # then edit — see below
```

Create the database, via phpMyAdmin or:

```sql
CREATE DATABASE techciti_reports
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Then bring up schema and demo data:

```bash
npm run setup     # db:generate + db:push + seed
```

`npm run seed` prints the super admin credentials and five working tutor portal URLs.

```bash
npm run dev       # tsx watch  → http://localhost:4000
# or
npm run build && npm start   # compiled → dist/server.js
```

Confirm it's alive:

```bash
curl http://localhost:4000/api/health
# {"success":true,"data":{"status":"ok","database":"up","timezone":"Africa/Lagos",...}}
```

#### Environment variables

| Variable | Purpose | Example |
| --- | --- | --- |
| `NODE_ENV` | Runtime mode | `development` |
| `PORT` | API port | `4000` |
| `DATABASE_URL` | Prisma MySQL DSN | `mysql://root:@localhost:3306/techciti_reports` |
| `JWT_SECRET` | Admin session signing key (**≥ 32 chars, required**) | *(generate)* |
| `JWT_EXPIRES_IN` | Admin session lifetime | `8h` |
| `COOKIE_NAME` | Session cookie name | `techciti_admin_session` |
| `COOKIE_SECURE` | Force `Secure` (set `true` in production) | `false` |
| `SUPER_ADMIN_NAME` / `_EMAIL` / `_PASSWORD` | Seeded super admin | `admin@techciti.ng` |
| `ADMIN_ORIGIN` | Only origin allowed on `/api/admin/*` | `http://localhost:3001` |
| `TUTOR_ORIGIN` | Only origin allowed on `/api/tutor/*` | `http://localhost:3000` |
| `TUTOR_PORTAL_URL` | Public base URL for shareable `/t/<token>` links | `http://localhost:3000` |
| `DEFAULT_TIMEZONE` | Business timezone | `Africa/Lagos` |
| `MAX_MONTHS_AHEAD` | How far ahead a month may be filed | `0` |
| `LOG_LEVEL` | Pino log level | `info` |
| `TRUST_PROXY` | Trust `X-Forwarded-For` behind a proxy | `1` |
| `UPLOAD_MAX_MB` | Bulk-import upload cap | `5` |
| `PUPPETEER_EXECUTABLE_PATH` | Browser for PDF; blank = auto-detect | *(optional)* |

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Validation is enforced by Zod at boot — a missing or weak `JWT_SECRET` fails fast
with a clear message instead of surfacing as a confusing runtime error later.

#### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Watch-mode dev server (`tsx`) |
| `npm run build` | `prisma generate` + `tsc` → `dist/` |
| `npm start` | Run the compiled build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run setup` | Generate client + push schema + seed |
| `npm run seed` | Idempotent demo data (`-- --reset` to wipe first) |
| `npm run db:sql` | Regenerate `database/schema.sql` |
| `npm run db:studio` | Prisma Studio |

#### phpMyAdmin deployment path

`npm run db:sql` regenerates `database/schema.sql` from the Prisma schema via
`prisma migrate diff`, so the SQL import path **cannot drift** from the ORM
definition. Create an empty `techciti_reports`, then phpMyAdmin → Import → select the
file. Verified by importing into a scratch database: 7 tables, 5 foreign keys,
executes cleanly.

#### Project layout

```
backend/
├── prisma/
│   ├── schema.prisma        # source of truth for the data model
│   └── seed.ts              # deterministic demo data
├── database/schema.sql      # generated, phpMyAdmin-ready
├── scripts/
│   ├── smoke.mjs            # 89-assertion end-to-end suite
│   └── write-schema-sql.mjs # schema.sql generator
└── src/
    ├── config/              # env (Zod-validated), constants
    ├── lib/                 # prisma, errors, month gate, crypto, pagination
    ├── middleware/          # auth-admin, auth-tutor, rate-limit, upload, validate
    ├── schemas/             # Zod schemas
    ├── modules/
    │   ├── tutor/           # token-authenticated portal
    │   └── admin/           # 9 sub-routers behind requireAdmin
    ├── app.ts               # middleware chain, split-origin CORS, error handler
    └── server.ts            # bootstrap
```

---

## Known Limitations

Documented deliberately rather than hidden:

- **`xlsx@0.18.5` carries a high-severity advisory with no fix on npm.** SheetJS moved
  distribution off the registry; the patched versions aren't installable normally. It was
  explicitly required for this project and is reachable only through admin-only bulk
  import (5 MB cap, extension allowlist, single file, in-memory, never written to disk).
  Migrating to `exceljs` — already a dependency — would close it at the cost of a
  stricter reader.
- **`uuid` (moderate) is transitive via `exceljs`**, not directly controllable.
- **Login throttling is in-process.** Correct for a single instance; a multi-instance
  deployment needs shared storage (Redis) or the limit is per-instance.
- **`next@15.1.6`** in the sibling frontend carries CVE-2025-66478. Out of scope here,
  flagged for a deliberate decision.

---

## Engineering Notes

A few decisions that reflect how I work rather than what's in the code:

**I test claims, not intentions.** When the README said the seed was idempotent, I ran
it three times and watched the totals climb 96 → 174 → 240. The claim was false, the
cascade was real, and the fix is now verified rather than asserted. Where a claim
*couldn't* be made true — byte-identical resets, since Prisma mints fresh CUIDs and
tutor tokens are `crypto.randomBytes` — the documentation now states the accurate,
narrower truth and explains why reusing tokens across a data wipe would be a security
bug.

**Boundaries are enforced where they can't be forgotten.** Ownership lives in the
query, not in handler code that a future contributor might skip. Prisma error codes
translate to HTTP status in exactly one table.

**Verification beats assertion.** Every load-bearing claim in this document was
produced by running something: the suite passes against both the dev runner and the
compiled build, `schema.sql` was proven by importing it, and the idempotency fix was
proven by repeated runs.