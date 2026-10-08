# TechCiti Tutor Report Portal

Frontend for TechCiti's monthly tutor reporting workflow — built with **Next.js (App Router), React 19, TypeScript, Tailwind CSS and shadcn/ui-style components**.

Tutors submit monthly student reports from a fast, dropdown-driven form on their phone.
Admins manage tutors, students and assignments, track who has submitted, and open any report
as a branded document.

> **Full stack.** The Next.js frontend (`lib/api.ts`) talks to the Express + Prisma backend in
> [`backend/`](backend/) — every screen reads and writes MySQL, there is no mock mode.

---

## Quick start

```bash
# Backend (Express + Prisma + MySQL) — first run only: npm run setup
cd backend && npm run dev        # http://localhost:4000

# Frontend, in a second terminal
npm run dev                      # http://localhost:3001 (or 3000)
```

Configuration lives in `.env.local` (see `.env.example`):

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
```

| Area | URL | Notes |
| --- | --- | --- |
| Landing page | `/` | Tutor start page: private-link entry + reporting guide (no admin links) |
| Admin login | `/admin/login` | Seeded admin: `admin@techciti.ng` / `TechCiti2026!` |
| Admin dashboard | `/admin` | Requires sign-in |
| Tutor portal | `/t/[token]` | One private link per tutor, copied from `/admin/tutors` |

Tutor links are issued by the backend per tutor — the admin copies one from the Tutors
screen (copy link / send on WhatsApp) and the tutor pastes it into the box on the
landing page to open their portal. The admin dashboard itself lives at `/admin/login`
and is deliberately not linked from the landing page.

### Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm start          # serve the production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

---

## What's in the box

### 1. Instructor portal — `/t/[token]`

- Orange hero banner with the signature slanted edge, greeting and month picker (defaults to the current month).
- Progress bar: “4 of 7 reports submitted”, with completion percentage.
- Student cards (name, grade, subject, status badge) — only students assigned to that tutor.
- Tap a card → report form in a **side drawer on desktop, full screen on mobile**:
  - Read-only auto-filled context (tutor, student, grade, subject, month, report ID).
  - Topics covered, with **quick-add suggestion chips** that toggle numbered list entries.
  - “Continuity needed?” toggle that reveals a follow-up textarea.
  - General feedback, private tutor comment, and **progress rating chips** (Excellent → Needs attention).
  - **Copy from last month**, **Save draft**, **Submit**.
  - **Autosave every few seconds** with a live “Saving… / Saved 14:32 / Autosave failed” indicator.
  - Client-side validation, confirmation dialog on submit, success state.
  - Duplicate submissions are blocked server-side (API returns `DUPLICATE_REPORT`) and the UI locks submitted reports as read-only.
  - If an admin requests a revision, the tutor sees the note and can edit and resubmit.
- Invalid token → friendly “This link isn't valid, please contact admin” page.

### 2. Admin portal — `/admin/*`

| Route | What it does |
| --- | --- |
| `/admin` | Month selector, 4 stat cards, completion bar, outstanding tutors with **“Remind on WhatsApp”** (pre-filled `wa.me` message), recent submissions |
| `/admin/reports` | Table with month / tutor / student / grade / subject / status filters, search, sortable columns, pagination |
| `/admin/reports/[id]` | Branded printable report layout + Download PDF, Download Word, Print, Mark as reviewed, Request revision (with note) |
| `/admin/tutors` | Search, add / edit / deactivate, copy private link, send link on WhatsApp |
| `/admin/students` | Search, grade + subject filters, add / edit / deactivate |
| `/admin/students/[id]` | Student summary + timeline of every monthly report |
| `/admin/assignments` | Link a tutor to a student + course + level |
| `/admin/courses` | Add / rename / deactivate the course catalogue |
| `/admin/import` | CSV / Excel upload for tutors and students with preview table, error highlighting, and confirm |

---

## Talking to the backend

Everything the UI reads or writes goes through **`lib/api.ts`** — a thin HTTP client over the
Express API. No component fetches directly and there is no mock data anywhere in the frontend.

### 1. Configure the URL

```bash
# .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
```

`request()` in `lib/api.ts` performs real HTTP calls, unwraps the backend's
`{ success, data }` envelope and maps backend views to the frontend types in `lib/types.ts`.

### 2. The routes it uses

Mounted under `/api` (see `backend/src/app.ts`):

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/admin/auth/login` | Seeded admin sign-in → http-only cookie |
| GET/POST/PATCH | `/api/admin/tutors` | List / create / edit tutors (+ activate, deactivate, link) |
| GET/POST/PATCH | `/api/admin/students` | List / create / edit students (+ profile) |
| GET/POST/DELETE | `/api/admin/assignments` | Link tutor ↔ student ↔ course |
| GET | `/api/admin/courses` | Course list for filters and forms |
| GET | `/api/admin/reports`, `/api/admin/reports/:id` | Paginated report table + detail |
| POST | `/api/admin/reports/:id/review`, `/request-revision` | Review actions |
| GET | `/api/admin/dashboard?month=` | Stat cards, outstanding tutors, recent submissions |
| POST | `/api/admin/import/preview`, `/commit` | CSV / Excel bulk import |
| GET/POST | `/api/tutor/...` (`X-Tutor-Token`) | Portal payload, draft save, submit |

The backend's contract is enforced by `node scripts/contract-check.mjs` inside `backend/`
(see [`backend/README.md`](backend/README.md) for setup, schema, seeds and API details).

Errors come back as `{ success: false, error: { code, message, details } }`;
`lib/api.ts` maps `code` to `ApiError` and flattens `details` into the inline `fieldErrors`.

### 3. Auth

`POST /api/admin/auth/login` sets an http-only session cookie; `auth.getSession()` reads it via
`GET /api/admin/auth/session`, and `hooks/use-admin-session.ts` guards the admin routes. There is
no token in `localStorage`.

### 4. PDF / Word downloads

`documents.downloadPdf()` and `documents.downloadWord()` call the backend's export endpoints
(Puppeteer → PDF, `docx` → Word). The on-screen layout in `components/admin/report-document.tsx`
is the design of record, and “Print → Save as PDF” produces a clean A4 document thanks to the
`@media print` rules in `app/globals.css`.

---

## Project structure

```
app/
  layout.tsx                  fonts, metadata, toast host, skip link
  globals.css                 brand tokens (CSS variables) + print styles
  fonts/                      self-hosted Manrope + Plus Jakarta Sans (variable woff2)
  page.tsx                    landing page
  t/[token]/page.tsx          instructor portal route
  admin/
    login/page.tsx            slanted orange panel + sign-in
    (portal)/layout.tsx       session guard + sidebar shell
    (portal)/page.tsx         dashboard
    (portal)/tutors|students|assignments|import|reports/…
components/
  admin/                      admin views, dialogs, report document
  instructor/                 portal shell, student cards, report drawer
  shared/                     month picker, stat cards, badges, rating chips…
  ui/                         Button, Card, Badge, Input, Select, Textarea,
                              Dialog, Sheet (drawer), Table, Tabs, Toast, …
  brand/logo.tsx              TechCiti mark + wordmark
hooks/
  use-async-data.ts           loading / error / refresh
  use-autosave.ts             debounced draft saving with status
  use-admin-session.ts        admin auth state
  use-toast.ts                toast store
  use-copy-to-clipboard.ts    copy helper
  use-media-query.ts          SSR-safe breakpoint hook
lib/
  api.ts                      ← the only data access layer (HTTP client for the backend)
  types.ts                    domain + view models
  constants.ts                grades, subjects, chip copy, status colours
  messages.ts                 WhatsApp message templates
  utils.ts                    cn(), date + month helpers, phone/wa.me helpers
```

---

## Brand system

Defined once as CSS variables in `app/globals.css` and exposed as Tailwind tokens — **components
never hard-code a hex value.**

| Token | Value | Used for |
| --- | --- | --- |
| `--primary` | `#FF5733` | primary buttons, active states, key headings, links |
| `--primary-hover` | `#E64A2A` | hover |
| `--primary-soft` | `#FFF1EC` | tinted backgrounds, selected rows, badges |
| `--primary-foreground` | `#FFFFFF` | text on orange |
| `--background` | `#F8F9FA` | page background |
| `--surface` | `#FFFFFF` | cards |
| `--foreground` | `#1F2937` | body text |
| `--muted-foreground` | `#6B7280` | secondary text |
| `--border` | `#E5E7EB` | borders |
| `--success` / `--warning` / `--danger` | `#4CAF50` / `#F59E0B` / `#DC2626` | status badges |

Each colour also has an `*-rgb` channel triplet so Tailwind can apply alpha
(`bg-primary/10`, `hover:bg-danger/90`).

- **Typeface:** Manrope (400–800), falling back to Plus Jakarta Sans, then system sans. Both are
  **self-hosted** as latin variable fonts in `app/fonts/` and loaded with `next/font/local`, so
  builds never depend on Google Fonts being reachable. To swap the real typeface, drop the woff2
  files in `app/fonts/` and update the two `localFont()` calls in `app/layout.tsx`.
- **Signature detail:** soft brand gradients (`.brand-gradient`), ambient glows (`.brand-glow`),
  frosted sticky headers (`.glass`) and a hover lift (`.lift`) on cards — used on the landing page,
  login panel, tutor portal hero and report masthead.
- **Radii & shadows:** cards are `16px`, buttons `12px`; elevation uses a two-layer shadow
  (`shadow-card` / `shadow-card-hover`) plus `shadow-brand` for primary-tinted surfaces.
- **Contrast:** white text is used on `--primary` only for bold 15–16px labels and large headings
  (WCAG AA large text). Body copy stays on `--foreground`/`--muted-foreground` for AA at any size.
- Light theme only, for now.

---

## Accessibility & UX notes

- Skip-to-content link; every control is reachable and operable by keyboard, with a brand-coloured focus ring.
- Radix primitives throughout for dialogs, drawers, selects, tabs, toasts — focus trapping and Escape handling included.
- Large tap targets (min 44px) and single-column layouts on the tutor portal, since tutors are on phones.
- Loading skeletons for every list and table, friendly empty states, and toast feedback on every action.
- `aria-live` announcements for autosave status and result counts; labels bound to controls with `aria-describedby` for hints and errors.
- Print stylesheet tuned for A4 (`@page` margins, hidden chrome, no shadows).

---

## Seed data

All demo content lives in the **database**, seeded by `backend/prisma/seed.ts`
(`npm run seed` inside `backend/`):

- **A super admin** — `admin@techciti.ng` / `TechCiti2026!` (override with
  `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`).
- **Courses** — Web Development Fundamentals, Python Programming, Data Analysis, etc.
- **5 tutors** with WhatsApp numbers and private portal tokens.
- **20 students** across the Kids / Teens age groups with parents' contact details.
- **~39 assignments** (some students have two courses or two tutors) and **~117 reports**
  over the last 3 months.

Re-seed any time with `npm run seed` (or `npm run setup` for a fresh database) inside
`backend/`. Test rows created while trying the UI can be removed with
`node scripts/purge-test-rows.mjs`.

---

## Notes & next steps

- **Upgrade Next.js before deploying.** The pinned `next@15.1.6` is flagged by npm for
  CVE-2025-66478. Run `npm install next@latest` (and `eslint-config-next@latest`) when you have a
  reliable connection, then re-run `npm run build`.
- Add the real TechCiti logo: the inline SVG in `components/brand/logo.tsx` is the only thing to swap.
- Document generation (PDF/Word), a parent-facing view and email/SMS notifications are stubs or out of scope for now.
- Duplicate-report protection is enforced per `(assignmentId, month)`. If TechCiti wants one
  submission per student per month regardless of subject, that check is a single `filter` in
  `portal.submit` in `lib/api.ts`.