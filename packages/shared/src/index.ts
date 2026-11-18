export const APP_NAME = "CareShift";

export const SHIFT_PRESETS = [
  { name: "Morning Shift", start: "06:00", end: "14:00" },
  { name: "Afternoon Shift", start: "14:00", end: "22:00" },
  { name: "Night Shift", start: "22:00", end: "06:00" },
] as const;

export const ISSUE_TYPES = [
  "Unable to complete",
  "Client refused",
  "Supplies unavailable",
  "Emergency",
  "Other",
] as const;

export const CATEGORIES = [
  "Personal Care",
  "Medication",
  "Meals",
  "Housekeeping",
  "Monitoring",
] as const;

export const PRIORITIES = ["high", "medium", "low"] as const;

export const ROLE = { admin: "admin", caregiver: "caregiver" } as const;

export const CARE_EVENT_TYPES = [
  "Bowel movement",
  "Urine output",
  "Medication given",
  "Stoma/catheter care",
  "Pain",
  "Intake",
  "Position change",
  "Observation",
  "Other",
] as const;

export const CARE_EVENT_SEVERITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

export type CareEventSeverity = (typeof CARE_EVENT_SEVERITIES)[number]["value"];

export type UserRole = "admin" | "caregiver";
export type AppRole = UserRole;
export type VisitStatus = "active" | "completed";

export function dateStrFrom(ms: number) {
  const date = new Date(ms);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export function todayStr(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export function formatTimeLabel(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function formatDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}
