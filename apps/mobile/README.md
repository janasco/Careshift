# CareShift Mobile (Expo)

Caregiver app for Android/iOS. It talks to the Cloudflare Workers API.

## Run locally

From the repository root:

```bash
npm install
npm run db:migrate:local   # first run only
npm run dev:api            # keep running, http://localhost:8787
npm run dev:mobile         # in a second terminal
```

Set the API URL in `apps/mobile/.env.local`:

```bash
EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:8787
```

The phone and the machine running the API must be on the same network. Scan the
QR code with Expo Go, or press `a` to start an Android emulator.

## Sign in

Use a caregiver account created by the admin. Imported accounts use the
temporary password from the Convex migration and should be reset afterward.

Admin accounts are intentionally redirected to the website.

## Current screens

- **Checklist** — today's tasks and one-tap completion
- **Visit** — GPS clock-in/out, live visit timer, handover notes
- **Meds** — today's doses, Given / Skip / Reset, low-stock warnings
- **Care** — add vital signs and care events, plus recent history
- **Handoff** — latest vitals, medications, care events, visit status, and open issues (from the Checklist screen)
- **Profile** — account info and sign out
