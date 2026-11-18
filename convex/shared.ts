// Shared constants + pure time math. Imported by both Convex functions (as
// "./shared") and the React app (via src/lib re-exports).

/** Simulated internal server time (seconds since epoch) for seeds, due checks, and audit rows. */
export const NOW: number = 1780656026;

export const CATEGORIES = [
  "Personal Care",
  "Medication",
  "Meals",
  "Housekeeping",
  "Monitoring",
] as const;

export const PRIORITIES = ["high", "medium", "low"] as const;

export const ISSUE_TYPES = [
  "Unable to complete",
  "Client refused",
  "Supplies unavailable",
  "Emergency",
  "Other",
] as const;

export const SHIFT_PRESETS = [
  { name: "Morning Shift", start: "06:00", end: "14:00" },
  { name: "Afternoon Shift", start: "14:00", end: "22:00" },
  { name: "Night Shift", start: "22:00", end: "06:00" },
] as const;

export const ROLE = { admin: "admin", caregiver: "caregiver" } as const;
export type AppRole = (typeof ROLE)[keyof typeof ROLE];

/** Splits ms-epoch into calendar parts in the runtime's local timezone. */
export function partsFromMs(ms: number) {
  const d = new Date(ms);
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    weekday: d.getDay(),
    minutes: d.getHours() * 60 + d.getMinutes(),
  };
}

export function dateStrFrom(ms: number) {
  const p = partsFromMs(ms);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Parses "YYYY-MM-DD" + "HH:MM" into ms-epoch (local time). */
export function msFrom(dateStr: string, hhmm: string) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  return new Date(y, (mo ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0, 0, 0).getTime();
}

export function minutesFromHHMM(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function hhmmFromMinutes(total: number) {
  const m = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * Is `hhmm` (task time) inside a shift window that may cross midnight?
 * `nowMin` is minutes since local midnight of the task's scheduled date.
 */
export function isTimeInShiftWindow(
  hhmm: string,
  shiftStart: string,
  shiftEnd: string,
  nowMin: number,
) {
  const t = minutesFromHHMM(hhmm);
  const s = minutesFromHHMM(shiftStart);
  const e = minutesFromHHMM(shiftEnd);
  if (e <= s) {
    if (nowMin <= e) return t <= e || t >= s;
    return t >= s;
  }
  return t >= s && t <= e;
}
