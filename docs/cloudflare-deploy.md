# Cloudflare deployment runbook

Target architecture:

- **Pages** serves the Vite website.
- **Workers** serves the Hono API.
- **D1** stores the database.
- **Durable Object** handles workspace realtime events.
- **Cron Trigger** materializes daily tasks/reminders.
- Better Auth handles email/password sessions.

For a production site, route the Worker on the **same hostname** as Pages:

```
https://app.example.com/        -> Pages
https://app.example.com/api/*   -> Worker (careshift-api)
```

This keeps auth cookies same-origin.

## 1. Authenticate Wrangler

```bash
npx wrangler login
```

Or set `CLOUDFLARE_API_TOKEN` in the environment. The token needs Workers,
Pages, D1, and Durable Objects edit permissions.

## 2. Create the production D1 database

```bash
npx wrangler d1 create careshift
```

Copy the `database_id` into `apps/api/wrangler.jsonc` (replace the all-zero
placeholder).

## 3. Configure production values

In `apps/api/wrangler.jsonc`:

- `BETTER_AUTH_URL` → `https://app.example.com`
- `WEB_ORIGIN` → `https://app.example.com`
- `TIMEZONE_OFFSET_MINUTES` → `480` (Asia/Manila)

Add the auth secret:

```bash
npx wrangler secret put BETTER_AUTH_SECRET --config apps/api/wrangler.jsonc
```

Use a long random value (32+ bytes).

Add the same-zone Worker route:

```jsonc
"routes": [
  { "pattern": "app.example.com/api/*", "zone_name": "example.com" }
]
```

## 4. Apply schema and import data

```bash
npm run db:migrate:remote
```

To carry over the current Convex data:

```bash
IMPORT_TEMP_PASSWORD='set-a-temporary-password' \
  node apps/api/scripts/import-convex.mjs

npx wrangler d1 execute careshift --remote \
  --config apps/api/wrangler.jsonc \
  --file /tmp/opencode/careshift-import.sql
```

Imported accounts use the temporary password. Reset them after login. Convex
Auth passwords cannot be reused because Better Auth uses a different hash.

If starting fresh instead, create the first admin with:

```bash
curl -X POST https://app.example.com/api/bootstrap/admin \
  -H 'Content-Type: application/json' \
  -d '{"name":"Admin","email":"admin@example.com","password":"change-me-123"}'
```

## 5. Deploy the API

```bash
npm run deploy:api
```

Check:

```bash
curl https://app.example.com/api/health
```

## 6. Deploy the website

If the Worker is routed at `/api/*` on the same host, leave `VITE_API_URL` empty.
Otherwise set it to the Worker origin in `apps/web/.env.production.local`.

```bash
npm run deploy:web
```

In Cloudflare Pages, add `app.example.com` as the custom domain. Ensure the
Worker route above takes precedence for `/api/*`.

## 7. Post-deploy checks

- `/api/health` returns `{ ok: true }`
- Sign in as the admin
- Patients, vitals, care log, medications, visits, history, and reports render
- Caregiver login reaches `/checklist` and clock-in/out works with GPS
- Browser console has no auth/CORS errors

## Realtime

The Worker exposes `/api/realtime?workspace=default` through a Durable Object.
The web client invalidates React Query caches on broadcast messages. Ensure the
route is on the same host so the WebSocket is not blocked by CORS.

## Rollback

The pre-migration Convex version is tagged `convex-backup`:

```bash
git checkout convex-backup
```

The old Convex deployment is still available locally through `npm run convex:dev`.
