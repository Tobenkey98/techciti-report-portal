# TechCiti Tutor Report Portal

Frontend for TechCiti's monthly tutor reporting workflow — built with **Next.js (App Router), React 19, TypeScript, Tailwind CSS and shadcn/ui-style components**.

Tutors submit monthly student reports from a fast, dropdown-driven form on their phone.
Admins manage tutors, students and assignments, track who has submitted, and open any report
as a branded document.

> **Frontend only.** All data comes from a typed mock API layer (`lib/api.ts`) backed by
> realistic seed data. Swap one environment flag to point the whole app at an Express backend.

---

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

| Area | URL | Notes |
| --- | --- | --- |
| Landing page | `/` | Entry points + demo tutor links |
| Admin login | `/admin/login` | `admin@techciti.ng` / `TechCiti2026!` |
| Admin dashboard | `/admin` | Requires sign-in |
| Tutor portal | `/t/amaka-obi-9f2c` | One private link per tutor |

The login page also lists working tutor links and an invalid one (`/t/this-token-does-not-exist`)
so you can see every state without hunting through the code.

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
| `/admin/assignments` | Link a tutor to a student + subject; a student can have several subjects or tutors |
| `/admin/import` | CSV / Excel upload for tutors and students with preview table, error highlighting, and confirm |

---

## Connecting the real backend

Everything the UI reads or writes goes through **`lib/api.ts`**. No component imports mock data
directly. `lib/mock-data.ts` is only ever touched by that file.

### 1. Flip the switch

```bash
# .env.local
NEXT_PUBLIC_USE_MOCK_API=false
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
```

`request()` in `lib/api.ts` then performs real HTTP calls with the same return types.

### 2. Implement the routes

| Method | Route | Returns |
| --- | --- | --- |
| POST | `/auth/login` | `AdminSession` |
| GET | `/instructors` | `Instructor[]` |
| POST | `/instructors` | `Instructor` |
| PATCH | `/instructors/:id` | `Instructor` |
| PATCH | `/instructors/:id/token` | `Instructor` |
| GET | `/students` | `Student[]` |
| POST/PATCH | `/students`, `/students/:id` | `Student` |
| GET | `/students/:id/profile` | `StudentProfile` |
| GET/POST/DELETE | `/assignments` | `Assignment[]` / `Assignment` |
| GET | `/reports?month=&tutor=&…` | `PaginatedResult<ReportWithContext>` |
| GET | `/reports/:id` | `ReportWithContext` |
| PATCH | `/reports/:id` | `ReportWithContext` (review actions) |
| GET | `/instructors/portal?token=&month=` | `InstructorPortalData` |
| POST | `/reports/draft` | `Report` |
| POST | `/reports/submit` | `Report` |
| POST | `/reports/copy-previous` | `Report` |
| GET | `/dashboard?month=` | `DashboardData` |
| POST | `/import/preview`, `/import/commit` | `ImportPreview` / `ImportResult` |
| GET | `/reports/:id/pdf`, `/reports/:id/docx` | `{ url }` |

Errors should come back as `{ code, message, fieldErrors? }` where `code` is one of
`NOT_FOUND | VALIDATION | DUPLICATE_REPORT | UNAUTHORIZED | CONFLICT` (see `ApiError` in `lib/types.ts`).
`fieldErrors` powers the inline form errors.

All types live in **`lib/types.ts`** — share that file with the backend (or generate from it).

### 3. Auth

Mock mode stores the session in `localStorage` behind `auth.login/logout/getSession`
(`hooks/use-admin-session.ts`). For production, return an http-only session cookie from
`POST /auth/login` and read `session` in `app/admin/(portal)/layout.tsx` on the server —
no component needs to change.

### 4. PDF / Word downloads

`documents.downloadPdf()` and `documents.downloadWord()` are **stubs that throw** with an
explanatory `ApiError`. The on-screen layout in `components/admin/report-document.tsx` is the
design of record: have the backend render that same structure (Playwright/Puppeteer → PDF,
`docx` → Word). “Print → Save as PDF” already produces a clean A4 document thanks to the
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
  api.ts                      ← the only data access layer
  types.ts                    domain + view models
  mock-data.ts                5 tutors, 20 students, ~29 assignments, 3 months of reports
  constants.ts                grades, subjects, chip copy, status colours, demo creds
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
- **Signature detail:** the slanted diagonal edge (`.slant-bottom`, `.slant-left`, `.slant-right`
  clip-paths) on the login panel and dashboard/portal header banners, echoing the techciti.ng hero.
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

`lib/mock-data.ts` is deterministic (no `Math.random`), so the server and client render identical
markup. It generates:

- **5 tutors** with realistic names, subjects, WhatsApp numbers and private tokens.
- **20 students** across Primary 4 → SSS 3 with parents' contact details.
- **29 assignments** (some students have two subjects or two tutors).
- **Reports for the last 3 months**, with the current month deliberately mixed: submitted, reviewed,
  draft, needs-revision and not-started.

Reset the mock data at any time by reloading the dev server (the store lives on `globalThis`),
or call `resetMockData()` from `lib/api.ts` in the console.

---

## Notes & next steps

- Frontend only — no backend, no database, no real authentication.
- **Upgrade Next.js before deploying.** The pinned `next@15.1.6` is flagged by npm for
  CVE-2025-66478. Run `npm install next@latest` (and `eslint-config-next@latest`) when you have a
  reliable connection, then re-run `npm run build`.
- Add the real TechCiti logo: the inline SVG in `components/brand/logo.tsx` is the only thing to swap.
- Document generation (PDF/Word), a parent-facing view and email/SMS notifications are stubs or out of scope for now.
- Duplicate-report protection is enforced per `(assignmentId, month)`. If TechCiti wants one
  submission per student per month regardless of subject, that check is a single `filter` in
  `portal.submit` in `lib/api.ts`.