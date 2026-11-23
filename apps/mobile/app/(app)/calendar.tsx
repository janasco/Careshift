import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";

import { apiGet } from "@/lib/api";

type CalendarEvent = {
  id: string;
  patientName: string | null;
  title: string;
  eventType: string;
  location: string | null;
  notes: string | null;
  startMs: number;
  endMs: number | null;
  allDay: boolean;
};

function clock(ms: number) {
  const date = new Date(ms);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function dayKey(ms: number) {
  const date = new Date(ms);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function dayLabel(ms: number) {
  const value = new Date(ms);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (dayKey(ms) === dayKey(today.getTime())) return "Today";
  if (dayKey(ms) === dayKey(tomorrow.getTime())) return "Tomorrow";
  return value.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export default function AgendaScreen() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  to.setDate(to.getDate() + 14);
  to.setHours(23, 59, 59, 999);

  const events = useQuery({
    queryKey: ["calendar", "caregiver", dayKey(from.getTime())],
    queryFn: () =>
      apiGet<CalendarEvent[]>(
        `/api/calendar?fromMs=${from.getTime()}&toMs=${to.getTime()}`,
      ),
    refetchInterval: 60_000,
  });

  const grouped = new Map<string, CalendarEvent[]>();
  for (const event of events.data ?? []) {
    const key = dayKey(event.startMs);
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Shared calendar</Text>
        <Text style={styles.subtitle}>
          Doctor appointments, family visits, and reminders for the next two
          weeks.
        </Text>
      </View>

      {events.isLoading ? (
        <Text style={styles.muted}>Loading calendar…</Text>
      ) : events.isError ? (
        <Text style={styles.error}>
          {events.error instanceof Error
            ? events.error.message
            : "Could not load the calendar."}
        </Text>
      ) : (events.data ?? []).length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing scheduled</Text>
          <Text style={styles.emptyText}>
            The organizer has not added any appointments or visits yet.
          </Text>
        </View>
      ) : (
        Array.from(grouped.entries()).map(([key, list]) => (
          <View key={key} style={{ gap: 8 }}>
            <Text style={styles.day}>{dayLabel(list[0].startMs)}</Text>
            {list.map((event) => (
              <View key={event.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.time}>
                      {event.allDay
                        ? "All day"
                        : `${clock(event.startMs)}${
                            event.endMs ? ` – ${clock(event.endMs)}` : ""
                          }`}
                    </Text>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.meta}>
                      {event.patientName ?? "All care"}
                      {event.location ? ` · ${event.location}` : ""}
                    </Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{event.eventType}</Text>
                  </View>
                </View>
                {event.notes ? (
                  <Text style={styles.notes}>{event.notes}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16, gap: 14 },
  header: { gap: 4, marginBottom: 2 },
  title: { fontSize: 22, fontWeight: "900", color: "#0f172a" },
  subtitle: { fontSize: 13, color: "#64748b", lineHeight: 19 },
  muted: { color: "#64748b", fontSize: 13 },
  error: { color: "#dc2626", fontSize: 13 },
  empty: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 22,
    alignItems: "center",
    gap: 6,
  },
  emptyTitle: { fontSize: 15, fontWeight: "800", color: "#0f172a" },
  emptyText: { fontSize: 13, color: "#64748b", textAlign: "center" },
  day: {
    fontSize: 12,
    fontWeight: "800",
    color: "#115e59",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 6,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 6,
  },
  cardHead: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  time: { fontSize: 11, fontWeight: "800", color: "#0f766e" },
  eventTitle: { fontSize: 15, fontWeight: "800", color: "#0f172a", marginTop: 2 },
  meta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  badge: {
    backgroundColor: "#ccfbf1",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 10, fontWeight: "700", color: "#115e59" },
  notes: { fontSize: 12, color: "#64748b", lineHeight: 17 },
});
