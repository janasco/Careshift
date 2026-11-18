# ShiftAid — Caregiver Task & Shift Tracking System

A production-ready caregiver shift & checklist tracking system. Caregivers complete
their daily checklist in one tap on mobile; supervisors monitor progress in real time
from a full operations dashboard. Every action is timestamped, attributed, and
preserved for accountability.

Built with **Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui + Convex**
(backend, database, auth, realtime) as a **PWA** installable on Android/iOS home
screens. One codebase, no separate Android app needed — and the architecture is
designed to scale from 3 caregivers to 50+ without schema changes.

---

## Repository structure

```
Careshift/
├─ apps/
│  ├─ web/                 # admin/supervisor website (Vite + React)
│  │  ├─ src/pages/admin/  # dashboard, patients, staff, meds, visits, reports
│  │  └─ src/pages/CaregiverChecklist.tsx  # mobile-first PWA checklist
│  └─ mobile/              # caregiver app (Expo / React Native)
│     ├─ app/(auth)/       # sign in
│     └─ app/(app)/        # checklist, visit clock-in/out, profile
├─ packages/
│  └─ shared/              # shared constants, types, date/time helpers
├─ convex/                 # single backend for web + mobile
├─ package.json            # npm workspaces
└─ convex.json
```

## Quick start

```bash
npm install

# Terminal 1 — backend
npm run convex:dev

# Terminal 2 — website
npm run dev:web           # http://localhost:5173

# Optional — Expo caregiver app
npm run dev:mobile
```

To push schema/functions once without the watcher:

```bash
npm run convex:once
```

See `apps/mobile/README.md` for phone/emulator setup and the Convex URL.

### First-run setup

On first open, the sign-in page shows a **one-time workspace setup form**: create the
administrator account (your name, email, and a password of at least 8 characters).
The first account created becomes the admin — the setup form disappears afterwards.

### Creating caregiver accounts

1. Sign in as the administrator → **Caregivers → Add caregiver**.
2. Fill in name, email (used to sign in), phone, optional employee code, shift, and
   an **initial password** (at least 8 characters).
3. Share the email + password with the caregiver securely — they sign in at `/auth`
   and land on their own checklist.

If a caregiver forgets their password, use the key icon on their row to set a new one
(takes effect immediately, and is recorded in the audit log).

A **Settings → Reset workspace** action permanently clears all data (caregivers,
tasks, history, issues, audit logs) and restores the three standard shifts, letting
you start fresh; the admin account is recreated through the setup form again.

---

## Features

### Supervisor (admin)
- **Dashboard** — live totals (today's tasks, completed, pending, overdue, issues),
  per-caregiver status with progress bars, completion-by-shift chart, task-state chart.
  Updates in real time as caregivers check tasks off.
- **Today's Schedule** — chronological view grouped by shift with live status chips;
  add one-off tasks for any caregiver.
- **Caregivers** — add/edit/disable accounts with an initial password, reset
  passwords (audited), view per-caregiver timeline and details.
- **Shifts** — create custom shifts; overnight windows supported and labeled.
- **Task Templates** — full CRUD by category, priority, duration, required/recurring.
  Templates are **deactivated, never deleted** — history is preserved.
- **Assignments** — recurring schedules by task × shift × caregiver × days × time,
  materialized into daily checklists automatically.
- **History** — filter by date range, caregiver, shift, task, status; export **CSV**
  or **print/PDF**.
- **Reports** — daily, per-caregiver (incl. average minutes late), and per-shift
  reports over any date range, with exports.
- **Issues** — open/resolved tabs, resolve with a note (audited).
- **Audit Log** — filterable record of every important action with before/after values,
  exportable to CSV.
- **Settings** — workspace reset (clears all data; standard shifts restored).

### Caregiver (mobile-first)
- Signs in → sees **only** their shift and today's checklist (enforced server-side).
- **One tap to complete** — confirm dialog records exact time, caregiver, and task.
- Notes and **issue reporting** (5 issue types) per task.
- Large 48px tap targets, sticky progress header, live clock.
- **Offline-safe**: if the network drops, completions/issues queue locally and sync
  automatically when back online. Duplicate submissions are prevented.

---

## Architecture

```
apps/web/src/          # Website (Vite + React)
  pages/admin/         # dashboard, patients, caregivers, shifts, tasks,
                       # assignments, medications, care log, vitals, visits,
                       # history, reports, issues, audit, settings
  pages/CaregiverChecklist.tsx  # mobile-first PWA checklist + clock-in/out
  components/          # AppShell, Timeline, ui/ (shadcn)
  hooks/               # profile, clock, offline queue, auth
  lib/                 # formatters, status logic, CSV/print export, schemas
apps/mobile/app/       # Expo caregiver app
  (auth)/sign-in.tsx
  (app)/checklist.tsx
  (app)/visit.tsx
  (app)/profile.tsx
packages/shared/       # constants, severity/type helpers, date/time helpers
convex/                # Backend shared by both apps
  schema.ts            # users, profiles, caregivers, shifts, patients, tasks,
                       # assignments, scheduledTasks, completions, issues,
                       # vitals, care events, medications, medication logs,
                       # visits, audit logs
  profiles.ts          # profile + caregiver account management, audit helper
  shifts.ts            # shift CRUD + safe delete
  tasks.ts             # task template CRUD (soft-delete)
  assignments.ts       # recurring schedules + daily materialization
  checklist.ts         # caregiver checklist queries + complete/report-issue
  patients.ts          # patient profiles and summaries
  vitals.ts            # vital-sign readings and trends
  careEvents.ts        # toileting, medication, stoma, pain, intake log
  medications.ts       # schedules, dose logs, adherence, stock
  visits.ts            # EVV clock-in/out and GPS audit
  admin.ts             # dashboard summary, directory, history, issues
  reports.ts           # daily / caregiver / shift / trend reports
  timeline.ts          # caregiver activity timelines
  issues.ts            # issue resolution
  audit.ts             # audit log query
  bootstrap.ts         # workspace status/reset + one-time admin claim
  shared.ts            # constants + pure time math shared by server
```

### Design decisions

- **One backend, two clients**: the website and Expo app share the same Convex
  schema, auth, and generated API types.
- **Server-side everything**: completion timestamps, status transitions, and the
  audit trail are written in Convex mutations. The client cannot forge them.
- **Patients are first-class**: vitals, care events, and medications link to a
  patient record; aliases map alternate names to the same person.
- **Historical immutability**: completed records are never edited or deleted.
  Deactivating a template/assignment stops future generation only.
- **Dynamic caregiver count**: nothing is hard-coded to 3 caregivers. Assignments can
  target "any caregiver on shift", so new hires instantly receive tasks.
- **Overnight shifts**: due times before shift start roll to the next calendar day;
  the materializer and status logic both handle this.
- **Realtime**: Convex queries are reactive subscriptions — the dashboard updates
  without page refreshes the moment a caregiver acts.
- **Extensibility**: photo attachments, pay integration, push notifications, and
  richer medication recurrence patterns can layer on without breaking changes.

### Design decisions

- **Server-side everything**: completion timestamps, status transitions, and the
  audit trail are written in Convex mutations. The client cannot forge them.
- **Historical immutability**: completed records are never edited or deleted.
  Deactivating a template/assignment stops future generation only.
- **Dynamic caregiver count**: nothing is hard-coded to 3 caregivers. Assignments can
  target "any caregiver on shift", so new hires instantly receive tasks.
- **Overnight shifts**: due times before shift start roll to the next calendar day;
  the materializer and status logic both handle this.
- **Realtime**: Convex queries are reactive subscriptions — the dashboard updates
  without page refreshes the moment a caregiver acts.
- **Extensibility**: multi-client/patient, photo attachments, pay integration, and
  push notifications can layer on top of the existing tables without breaking changes.

---

## Setup & deployment

### Environment

`convex dev` writes `CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`, and
`VITE_CONVEX_SITE_URL` to `.env.local` at the repository root. The website reads
that file via Vite's `envDir`.

The mobile app reads `apps/mobile/.env.local`:

```bash
EXPO_PUBLIC_CONVEX_URL=http://YOUR_LAN_IP:3210
```

For a self-managed deployment:

```bash
npx convex deploy          # push functions to production deployment
npm run build:web          # build the website (apps/web/dist)
```

Then host `apps/web/dist/` on any static host (Vercel, Netlify, Cloudflare
Pages) with `VITE_CONVEX_URL` pointing at your Convex production deployment.

### PWA installation

On Android Chrome: open the app → menu → **Add to Home screen**. The app installs
with its own icon and runs standalone. The service worker caches the shell so the
checklist keeps working through brief connectivity loss; queued completions sync
automatically.

### Packaging as Android app (optional later)

The PWA can be wrapped with **Bubblewrap** (Trusted Web Activity) or Capacitor to
publish to the Play Store without rewriting any UI:

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://your-domain/manifest.webmanifest
bubblewrap build
```

---

## Security model

- Email + password auth via Convex Auth (Lucia Scrypt hashing); sessions expire
  automatically. Passwords are only set by the administrator or the one-time
  setup form — there is no open sign-up.
- Role gate on every route (`RoleRoute`) **and** on every query/mutation —
  `caregiver` records are filtered by the caller's own ID server-side.
- Input validation with zod on forms and Convex validators on every function.
- Audit log captures actor, action, entity, and old/new values for
  logins, completions, issues, account changes, shifts, and assignments.
