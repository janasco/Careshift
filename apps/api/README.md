# CareShift API (Cloudflare Workers)

New Cloudflare-native backend, built alongside the existing Convex implementation
while the migration is in progress.

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
Copy `.dev.vars.example` if it does not exist.

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
| GET/POST | `/api/patients` | Admin only |
| GET/PATCH | `/api/patients/:id` | Admin only |
| GET/POST | `/api/vitals` | Authenticated |
| PATCH | `/api/vitals/:id` | Admin only |
| GET | `/api/realtime?workspace=default` | Durable Object WebSocket |

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
