# Careshift Mobile (Expo)

Caregiver app for Android/iOS. It talks to the same Convex backend as the web app.

## Run locally

From the repository root:

```bash
npm install
npm run convex:dev        # keep running
npm run dev:mobile        # in a second terminal
```

Set the Convex URL in `apps/mobile/.env.local`:

```bash
EXPO_PUBLIC_CONVEX_URL=http://YOUR_LAN_IP:3210
```

The phone and the machine running Convex must be on the same network. Scan the
QR code with Expo Go, or press `a` to start an Android emulator.

## Sign in

Use a caregiver account created by the admin, for example:

- `jane.andales@apexsinc.com`
- `james.paradero@apexsinc.com`
- `jaycar.inso@apexsinc.com`

Admin accounts are intentionally redirected to the website.

## Current screens

- **Checklist** — today's tasks and one-tap completion
- **Visit** — GPS clock-in/out, live visit timer, handover notes
- **Profile** — account info and sign out

Medication confirmation and care-event entry are next; the web app remains the
admin surface for patients, staff, shifts, medications, reports, and the audit log.
