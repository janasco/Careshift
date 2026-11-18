import { dateStrFrom } from "@careshift/shared";
import { format } from "date-fns";

export { dateStrFrom };

export function formatTime(ms: number) {
  return format(new Date(ms), "h:mm a");
}

export function formatTimeColon(ms: number) {
  return format(new Date(ms), "HH:mm");
}

export function formatDateShort(ms: number) {
  return format(new Date(ms), "MMM d, yyyy");
}

export function formatDateLong(ms: number) {
  return format(new Date(ms), "EEEE, MMMM d, yyyy");
}

export function formatHhmmLabel(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const hr = ((h ?? 0) % 12) || 12;
  const suffix = (h ?? 0) < 12 ? "AM" : "PM";
  return `${hr}:${String(m ?? 0).padStart(2, "0")} ${suffix}`;
}

export function shiftRangeLabel(start: string, end: string) {
  return `${formatHhmmLabel(start)} – ${formatHhmmLabel(end)}`;
}
