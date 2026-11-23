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

## Android APK

A debug APK is served by the local website:

```
http://10.0.0.243:5173/downloads/careshift-debug.apk
```

- `arm64-v8a`, debug-signed, package `com.apexsinc.careshift`
- The API URL is baked in from `EXPO_PUBLIC_API_URL` at build time
- Install from the phone browser and allow installs from unknown sources

To rebuild (JDK 21 + Android SDK required):

```bash
npm run prebuild:android
npm run apk:android
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

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
- **Profile** — account info, device reminders, and sign out

## Device reminders

Open **Profile → Enable device reminders** and allow notifications. While the
app is running, it schedules local reminders for:

- pending tasks 10 minutes before they are due
- medication doses at their scheduled time

Only the next 24 hours are scheduled; opening the app refreshes the schedule.
