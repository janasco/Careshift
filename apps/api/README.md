# CareShift API (Cloudflare Workers)

Cloudflare-native backend for CareShift. The website and Expo app use this API;
the old Convex implementation is kept only on the `convex-backup` tag.

## Stack

- Cloudflare Workers
- Hono
- D1 (SQLite) + Drizzle ORM
- Better Auth (email/password, sessions)
- Durable Object for workspace realtime events
- Cron Trigger for future daily materialization

## Local development

From the repo root:

```bash
npm install
npm run db:generate          # generate Drizzle SQL from packages/db/src/schema.ts
npm run db:migrate:local     # apply migrations to the local D1 database
npm run dev:api              # http://localhost:8787
```

Secrets for local development live in `apps/api/.dev.vars` (ignored by Git).
In the maintainer workspace it is a symlink into the private repository; copy
`.dev.vars.example` if you do not have access to that repository.

Set `TRUSTED_ORIGINS` to a comma-separated list when the website is opened from
a LAN address or custom domain. `WEB_ORIGIN`, localhost, and the Expo schemes are
always allowed.

## First admin

```bash
curl -X POST http://localhost:8787/api/bootstrap/admin \
  -H 'Content-Type: application/json' \
  -d '{"name":"Admin","email":"admin@example.com","password":"change-me-123"}'
```

Public sign-up is disabled. The bootstrap endpoint only works while no admin
exists. Caregiver accounts will be created by admin endpoints in the next phase.

## Current endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | Runtime check |
| GET | `/api/bootstrap/status` | `{ needsSetup }` |
| POST | `/api/bootstrap/admin` | First admin only |
| POST/GET | `/api/auth/*` | Better Auth |
| GET | `/api/me` | Session, profile, shift |
| GET/POST/PATCH | `/api/caregivers` | Admin |
| GET/POST/PATCH/DELETE | `/api/shifts` | Auth read, admin write |
| GET/POST/PATCH | `/api/patients` | Admin |
| GET | `/api/patients/summaries` | Admin |
| GET/POST/PATCH | `/api/vitals` | Authenticated; admin edit |
| GET/POST/PATCH | `/api/care-events` | Authenticated; admin edit (care journal) |
| GET/POST/PATCH/DELETE | `/api/calendar` | Shared calendar; authenticated read, admin write |
| POST/DELETE | `/api/push/tokens` | Register or remove an Android FCM device token |
| POST | `/api/push/test` | Send a test push to the admin's devices |
| GET/POST/PATCH | `/api/medications` | Auth read, admin write |
| GET | `/api/medications/doses?date=` | Today's doses |
| POST | `/api/medications/doses/log` | Given / skipped / missed |
| POST | `/api/medications/doses/clear` | Reset a dose |
| GET | `/api/medications/adherence` | 7/30-day adherence |
| GET | `/api/visits/today?date=` | Caregiver active/today visit |
| POST | `/api/visits/clock-in` | Caregiver GPS visit start |
| POST | `/api/visits/clock-out` | Caregiver visit end |
| GET | `/api/visits?date=` | Admin visit list |
| GET/POST/PATCH/DELETE | `/api/tasks/templates` | Task library |
| GET/POST/PATCH/DELETE | `/api/tasks/assignments` | Recurring schedules |
| POST | `/api/tasks/materialize` | Generate daily tasks |
| GET | `/api/tasks/checklist/my-tasks?date=` | Caregiver checklist |
| POST | `/api/tasks/checklist/complete` | Complete task |
| POST | `/api/tasks/checklist/issue` | Report issue |
| POST | `/api/tasks/checklist/note` | Add task note |
| GET/PATCH | `/api/issues` | Admin issue management |
| GET | `/api/admin/summary?date=` | Dashboard totals |
| GET | `/api/admin/history` | History filters |
| GET | `/api/admin/audit` | Audit log |
| GET | `/api/admin/visits/overview?date=` | Not-started caregivers |
| GET | `/api/realtime?workspace=default` | Durable Object WebSocket |

`TIMEZONE_OFFSET_MINUTES` (default `480` for Asia/Manila) controls how local
shift times are converted to timestamps during materialization.

## Push notifications

The Worker runs a five-minute cron and sends Firebase Cloud Messaging alerts for:

- appointments starting within 30 minutes
- medication doses and tasks due within 10 minutes

Set the `FIREBASE_SERVICE_ACCOUNT` Worker secret to the Firebase Admin service
account JSON. The service account needs the **Firebase Cloud Messaging API
Admin** role. Both mobile apps register their FCM device token after the user
grants notification permission.

## Import existing Convex data

The generic importer is tracked in this repository:

```bash
IMPORT_TEMP_PASSWORD='a-temporary-password' node apps/api/scripts/import-convex.mjs
npx wrangler d1 execute careshift --local --config apps/api/wrangler.jsonc \
  --file import.sql
```

Real exports and import data belong in the private repository. Imported users
receive the temporary password; reset them from the admin UI after cutover.
Passwords from Convex Auth cannot be reused because Better Auth uses a different
password hash.

## Deploy

```bash
npx wrangler d1 create careshift
# put the returned database_id into apps/api/wrangler.jsonc
npx wrangler secret put BETTER_AUTH_SECRET --config apps/api/wrangler.jsonc
npm run db:migrate:remote
npm run deploy:api
```

The website will be deployed separately to Cloudflare Pages, with the API on a
custom domain or same-zone route.
