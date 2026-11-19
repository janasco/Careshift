import { useQuery } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatDuration, todayStr } from "@careshift/shared";

import { apiGet } from "@/lib/api";

type Vital = {
  id: string;
  timeLabel?: string | null;
  bp?: string | null;
  spo2?: number | null;
  pulse?: number | null;
  respiration?: number | null;
  temperature?: string | null;
  notes: string;
  createdAt: number;
};

type CareEvent = {
  id: string;
  eventType: string;
  severity?: string | null;
  timeLabel?: string | null;
  notes: string;
  createdAt: number;
};

type Medication = {
  id: string;
  name: string;
  dosage?: string | null;
  times: string[];
  doses: Array<{
    time: string;
    log: { status: "taken" | "skipped" | "missed" } | null;
  }>;
};

type Handoff = {
  date: string;
  patient: {
    id: string;
    fullName: string;
    preferredName?: string | null;
    room?: string | null;
    notes?: string | null;
  };
  latestVitals: Vital[];
  recentEvents: CareEvent[];
  medications: Medication[];
  visit: {
    caregiverName?: string | null;
    clockInAt: number;
    clockOutAt?: number | null;
    durationMs: number;
    status: "active" | "completed";
    clockInNotes?: string | null;
    clockOutNotes?: string | null;
  } | null;
  openIssues: Array<{ id: string; issueType: string; description: string }>;
};

export default function HandoffScreen() {
  const today = todayStr();
  const handoff = useQuery({
    queryKey: ["handoff", today],
    queryFn: () => apiGet<Handoff>(`/api/handoff?date=${today}`),
  });

  if (handoff.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  const data = handoff.data;
  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No patient summary available.</Text>
        <Pressable onPress={() => handoff.refetch()} style={styles.retry}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const latest = data.latestVitals[0];
  const totalDoses = data.medications.reduce(
    (sum, med) => sum + med.doses.length,
    0,
  );
  const takenDoses = data.medications.reduce(
    (sum, med) =>
      sum + med.doses.filter((dose) => dose.log?.status === "taken").length,
    0,
  );

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Shift handoff</Text>
          <Text style={styles.title}>{data.patient.fullName}</Text>
          <Text style={styles.subtitle}>
            {data.date} · {data.patient.room || "No room set"}
          </Text>
          <Pressable onPress={() => handoff.refetch()} style={styles.refresh}>
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Visit</Text>
          {data.visit ? (
            <>
              <Text style={styles.visitStatus}>
                {data.visit.status === "active" ? "In progress" : "Completed"}
                {data.visit.caregiverName ? ` · ${data.visit.caregiverName}` : ""}
              </Text>
              <Text style={styles.meta}>
                Clocked in{" "}
                {new Date(data.visit.clockInAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {data.visit.clockOutAt
                  ? ` · out ${new Date(data.visit.clockOutAt).toLocaleTimeString(
                      [],
                      { hour: "2-digit", minute: "2-digit" },
                    )}`
                  : ""}{" "}
                · {formatDuration(data.visit.durationMs)}
              </Text>
              {data.visit.clockOutNotes ? (
                <Text style={styles.note}>{data.visit.clockOutNotes}</Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.meta}>No visit recorded today.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Latest vital signs</Text>
          {latest ? (
            <>
              <Text style={styles.bigValue}>{latest.bp ?? "No BP"}</Text>
              <Text style={styles.meta}>
                SpO₂ {latest.spo2 ?? "—"}% · PR {latest.pulse ?? "—"} bpm · RR{" "}
                {latest.respiration ?? "—"} · Temp {latest.temperature ?? "—"}
              </Text>
              <Text style={styles.timestamp}>
                {latest.timeLabel ??
                  new Date(latest.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
              </Text>
              <Text style={styles.note}>{latest.notes}</Text>
            </>
          ) : (
            <Text style={styles.meta}>No vitals recorded yet.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Medications · {takenDoses}/{totalDoses} given
          </Text>
          {data.medications.length === 0 ? (
            <Text style={styles.meta}>No scheduled medications today.</Text>
          ) : (
            data.medications.map((med) => (
              <View key={med.id} style={styles.medRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.medName}>{med.name}</Text>
                  <Text style={styles.meta}>
                    {med.dosage ?? "Dose not set"} ·{" "}
                    {med.doses
                      .map((dose) => `${dose.time} ${dose.log?.status ?? "due"}`)
                      .join(" · ")}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent care events</Text>
          {data.recentEvents.length === 0 ? (
            <Text style={styles.meta}>No care events recorded.</Text>
          ) : (
            data.recentEvents.map((event) => (
              <View key={event.id} style={styles.eventRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventType}>
                    {event.eventType}
                    {event.severity ? ` · ${event.severity}` : ""}
                  </Text>
                  <Text style={styles.meta}>{event.notes}</Text>
                </View>
                <Text style={styles.timestamp}>
                  {event.timeLabel ??
                    new Date(event.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                </Text>
              </View>
            ))
          )}
        </View>

        {data.openIssues.length > 0 && (
          <View style={[styles.card, styles.issueCard]}>
            <Text style={styles.cardTitle}>Open issues</Text>
            {data.openIssues.map((issue) => (
              <Text key={issue.id} style={styles.issueText}>
                {issue.issueType}: {issue.description}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#f8fafc",
  },
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  hero: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 18,
    gap: 4,
  },
  eyebrow: { color: "#99f6e4", fontWeight: "700", fontSize: 12, textTransform: "uppercase" },
  title: { color: "#ffffff", fontWeight: "800", fontSize: 24 },
  subtitle: { color: "#cbd5e1", fontSize: 13 },
  refresh: {
    alignSelf: "flex-start",
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  refreshText: { color: "#0f172a", fontWeight: "700", fontSize: 12 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 6,
  },
  cardTitle: { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  visitStatus: { fontSize: 16, fontWeight: "700", color: "#0f766e" },
  bigValue: { fontSize: 28, fontWeight: "800", color: "#0f172a" },
  meta: { fontSize: 12, color: "#64748b", lineHeight: 17 },
  note: { fontSize: 13, color: "#334155" },
  timestamp: { fontSize: 11, color: "#94a3b8" },
  medRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 7,
    marginTop: 2,
  },
  medName: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  eventRow: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 7,
    marginTop: 2,
  },
  eventType: { fontSize: 13, fontWeight: "700", color: "#0f172a", textTransform: "capitalize" },
  issueCard: { borderColor: "#fecaca", backgroundColor: "#fff7f7" },
  issueText: { fontSize: 13, color: "#b91c1c" },
  emptyText: { color: "#64748b" },
  retry: { backgroundColor: "#0f766e", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  retryText: { color: "#ffffff", fontWeight: "700" },
});
