# CareShift Organizer (Expo)

Native Android app for the family organizer or supervisor. It manages the care
recipient, care team, medications, shared calendar, tasks, care journal, reports,
and issues.

Caregivers use the separate **CareShift Caregiver** app in
[`../mobile`](../mobile).

## Features

- **Today** — medication doses, appointments, task completion, open issues, and
  care-team progress
- **Calendar** — create appointments, family visits, and reminders for the whole
  team; delete or review event details
- **Meds** — dose schedule, one-tap confirmation, overdue and low-stock warnings,
  add medications
- **People** — care recipient profile and care team accounts, with add flows
- **More** — care journal, task board, daily reports, issue resolution, and profile

## Run locally

From the repository root:

```bash
npm install
npm run dev:api           # http://localhost:8787
npm run dev:organizer     # Expo
```

Set the API URL in `apps/organizer/.env.local`:

```bash
EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:8787
```

The organizer signs in with an `admin` account. Caregiver accounts are rejected
with a pointer to the CareShift Caregiver app.

## Google Play

CareShift Organizer is distributed through Google Play. No APK downloads are
published.

- Package: `com.apexsinc.careshift.organizer`
- Min Android 7.0 (`minSdk 24`), target SDK 36
- The API URL is baked in from `EXPO_PUBLIC_API_URL` at build time

Build the Android App Bundle from the repository root (JDK 21 + Android SDK and
the private upload key required):

```bash
npm run prebuild:organizer
npm run bundle:organizer
```

The bundle is written to
`android/app/build/outputs/bundle/release/app-release.aab`. Upload that file to
Play Console.

### Firebase config

Android builds require `apps/organizer/google-services.json` in the app root.
The file is gitignored and linked from the private repo by authorized
maintainers. Without it, Firebase-backed native builds will not configure
correctly.

## Screens

```
app/(auth)/sign-in.tsx        organizer sign-in
app/(app)/(tabs)/today.tsx    care overview
app/(app)/(tabs)/calendar.tsx shared calendar
app/(app)/(tabs)/medications.tsx
app/(app)/(tabs)/people.tsx   care recipient + care team
app/(app)/(tabs)/more.tsx     journal, tasks, reports, issues, profile
app/(app)/appointments/new.tsx
app/(app)/medications/new.tsx
app/(app)/patients/new.tsx
app/(app)/team/new.tsx
```
