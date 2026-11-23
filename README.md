# CareShift — Caregiver Task & Shift Tracking System

CareShift is a caregiver shift and checklist tracking system. Caregivers complete
their daily checklist from a phone; supervisors monitor progress, visits,
medications, vitals, issues, and audit history from an operations dashboard.

> **Repository split**
>
> - [`janasco/Careshift`](https://github.com/janasco/Careshift) — this public
>   repository. Source code and documentation only.
> - `janasco/careshift-private` — private repository for environment files,
>   credentials, patient imports, and database backups.
>
> Never commit `.env` files, tokens, API keys, real patient data, or backups to
> this repository. See [Private configuration](#private-configuration).

## Stack

- **Website:** Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui (PWA)
- **Mobile:** Expo / React Native (Android and iOS)
- **API:** Cloudflare Workers + Hono
- **Database:** Cloudflare D1 (SQLite) + Drizzle ORM
- **Auth:** Better Auth email/password sessions
- **Realtime:** Durable Object WebSocket broadcasts
- **Legacy backend:** Convex code remains on the `convex-backup` tag for rollback

## Repository structure

```
CareShift/
├─ apps/
│  ├─ web/                  # admin/supervisor website and mobile-first PWA
│  ├─ mobile/               # Expo caregiver app
│  └─ api/                  # Cloudflare Workers API (Hono, D1, Better Auth)
├─ packages/
│  ├─ shared/               # shared constants, types, date/time helpers
│  └─ db/                   # D1 schema and Drizzle migrations
├─ convex/                  # legacy Convex backend (rollback only)
├─ docs/                    # deployment runbook
├─ package.json             # npm workspaces
└─ README.md
```

## Features

### Supervisor

- Live dashboard: today's totals, completion rate, overdue tasks, issues, and
  per-caregiver progress
- Today's schedule grouped by shift
- Caregiver accounts, password resets, shifts, and workload views
- Task templates and recurring assignments materialized into daily checklists
- Patients, vitals, care events, medications and dose logs, visits, and reports
- History with CSV/print export, issue resolution, and a filterable audit log
- One-time workspace setup; public sign-up is disabled

### Caregiver

- Sign in and see only the assigned shift and today's checklist
- One-tap task completion with server-side timestamps and audit trail
- Task notes and issue reporting
- GPS clock-in/out with a live visit timer and handover notes
- Medication Given / Skip / Reset and low-stock warnings
- Vitals and care-event entry
- Handoff summary of recent care activity
- Local Android task and medication reminders
- Offline-safe queue for checklist actions

## Quick start

### Private configuration

Environment files and secrets intentionally live outside this repository. If you
have access to the private repository, clone it as a sibling and link the files:

```bash
git clone git@github.com:janasco/careshift-private.git /opt/repo/careshift-private
CARESHIFT_PUBLIC_DIR=/opt/repo/Careshift \
  /opt/repo/careshift-private/scripts/link-env.sh
```

The link script creates gitignored symlinks:

```
.env                 -> careshift-private/env/root.env
.env.local           -> careshift-private/env/root.env.local
.env.keys            -> careshift-private/env/root.env.keys
apps/api/.dev.vars   -> careshift-private/env/api.dev.vars
apps/mobile/.env.local -> careshift-private/env/mobile.env.local
```

Without access, start from the committed examples:

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
cp apps/mobile/.env.example apps/mobile/.env.local
```

Use a long random value for `BETTER_AUTH_SECRET`, never a production secret.

### Install and run

```bash
npm install
npm run db:migrate:local

# terminal 1 — API
npm run dev:api             # http://localhost:8787

# terminal 2 — website
npm run dev:web             # http://localhost:5173

# optional — Expo app
npm run dev:mobile
```

The mobile API URL comes from `EXPO_PUBLIC_API_URL` in
`apps/mobile/.env.local`. The phone and the API host must be on the same network.

### Android app

A debug APK is served by the local website at
`/downloads/careshift-debug.apk`. Build instructions, native requirements, and
device setup are in [`apps/mobile/README.md`](apps/mobile/README.md).

## Cloudflare API

```bash
npm run db:generate        # generate Drizzle SQL from packages/db
npm run db:migrate:local   # apply migrations to local D1
npm run dev:api            # local Worker with D1 binding
```

Local secrets belong in `apps/api/.dev.vars` (private, gitignored). Production
secrets belong in `wrangler secret put`; never add them to `wrangler.jsonc`.

Extra browser origins for LAN or custom-domain access can be supplied as a
comma-separated `TRUSTED_ORIGINS` value. `WEB_ORIGIN`, localhost, and the Expo
schemes are always allowed.

## Deployment

Create the D1 database, apply migrations, set Worker secrets, and deploy:

```bash
npx wrangler d1 create careshift
npm run db:migrate:remote
npx wrangler secret put BETTER_AUTH_SECRET --config apps/api/wrangler.jsonc
npm run deploy:api
```

The website is built with `npm run build:web` and deployed separately to
Cloudflare Pages. See [`docs/cloudflare-deploy.md`](docs/cloudflare-deploy.md)
for the full runbook. Remote deployment is not configured in this repository;
database IDs and deployment credentials stay private.

## Security model

- Better Auth email/password sessions with server-side role checks on every
  route and query. Caregivers can only read their own assignments.
- No public sign-up; the first admin is created through a one-time bootstrap form.
- Parameterized D1 queries and schema validation at the API boundary.
- Immutable history: completed tasks and care records are not edited or deleted;
  templates and assignments are deactivated instead.
- Audit log records actor, action, entity, and before/after values for account
  changes, task completion, issues, visits, and other important actions.
- Patient data is never seeded into public source. Local imports and exports live
  only in the private repository.

## Legacy Convex backend

Convex is no longer the active backend. The final Convex implementation is kept
on the `convex-backup` tag for rollback reference. Do not add new features there.
