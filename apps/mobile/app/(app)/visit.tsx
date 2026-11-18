import { useMutation, useQuery } from "convex/react";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatDuration, todayStr } from "@careshift/shared";

import { api, type Id } from "@/lib/convex";

type Visit = {
  _id: Id<"visits">;
  date: string;
  clockInAt: number;
  clockInLat?: number;
  clockInLng?: number;
  clockOutAt?: number;
  clockOutLat?: number;
  clockOutLng?: number;
  status: "active" | "completed";
};

async function getLocation() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return {};
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy ?? undefined,
    };
  } catch {
    return {};
  }
}

export default function VisitScreen() {
  const today = todayStr();
  const visit = useQuery(api.visits.myVisitForDate, { date: today }) as
    | Visit
    | null
    | undefined;
  const clockIn = useMutation(api.visits.clockIn);
  const clockOut = useMutation(api.visits.clockOut);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const doClockIn = async () => {
    setBusy(true);
    try {
      const location = await getLocation();
      await clockIn({ date: today, ...location });
      Alert.alert(
        "Clocked in",
        location.lat != null
          ? "Your location was recorded."
          : "GPS was unavailable, so this visit has no location.",
      );
    } catch (error) {
      Alert.alert(
        "Could not clock in",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const doClockOut = async () => {
    if (!visit) return;
    setBusy(true);
    try {
      const location = await getLocation();
      const result = await clockOut({
        visitId: visit._id,
        date: visit.date,
        notes: notes.trim() || undefined,
        ...location,
      });
      setNotes("");
      Alert.alert("Clocked out", `Visit duration: ${formatDuration(result.durationMs)}.`);
    } catch (error) {
      Alert.alert(
        "Could not clock out",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (visit === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  const active = visit?.status === "active";
  const duration = visit ? (visit.clockOutAt ?? now) - visit.clockInAt : 0;

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, active && styles.heroActive]}>
          <Text style={styles.eyebrow}>{active ? "Visit in progress" : "Visit"}</Text>
          <Text style={styles.timer}>{visit ? formatDuration(duration) : "00m"}</Text>
          <Text style={styles.date}>{today}</Text>
          {visit ? (
            <Text style={styles.meta}>
              Clocked in{" "}
              {new Date(visit.clockInAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {visit.clockOutAt
                ? ` · Clocked out ${new Date(visit.clockOutAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : ""}
            </Text>
          ) : (
            <Text style={styles.meta}>You have not clocked in yet.</Text>
          )}
        </View>

        {active && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Shift notes for handover</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Unfinished tasks, observations, handover notes…"
              multiline
              style={styles.notes}
            />
          </View>
        )}

        <View style={styles.gpsRow}>
          <Text style={styles.gpsLabel}>GPS</Text>
          <Text style={styles.gpsValue}>
            {visit?.clockInLat != null
              ? "Clock-in location recorded"
              : "No clock-in location"}
            {visit?.status === "completed"
              ? visit.clockOutLat != null
                ? " · Clock-out location recorded"
                : " · No clock-out location"
              : ""}
          </Text>
        </View>

        {!visit || visit.status === "completed" ? (
          <Pressable
            onPress={() =>
              Alert.alert(
                "Clock in?",
                "Your location will be recorded when permission is granted.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Clock in", onPress: doClockIn },
                ],
              )
            }
            disabled={busy}
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}
          >
            {busy ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>
                {visit ? "Clock in again" : "Clock in"}
              </Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            onPress={() =>
              Alert.alert(
                "Clock out?",
                "Make sure all checklist tasks are completed or reported before clocking out.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Clock out", style: "destructive", onPress: doClockOut },
                ],
              )
            }
            disabled={busy}
            style={({ pressed }) => [
              styles.button,
              styles.buttonDanger,
              pressed && { opacity: 0.8 },
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Clock out</Text>
            )}
          </Pressable>
        )}

        <Text style={styles.hint}>
          Clock-out is blocked while checklist tasks are still pending. Complete
          them or report an issue first.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 12 },
  hero: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 20,
    gap: 4,
  },
  heroActive: { backgroundColor: "#0f766e" },
  eyebrow: { color: "#99f6e4", fontWeight: "700", fontSize: 12, textTransform: "uppercase" },
  timer: { color: "#ffffff", fontWeight: "800", fontSize: 36, fontVariant: ["tabular-nums"] },
  date: { color: "#cbd5e1", fontSize: 13 },
  meta: { color: "#e2e8f0", fontSize: 13, marginTop: 4 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardTitle: { fontWeight: "700", color: "#0f172a" },
  notes: {
    minHeight: 84,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    padding: 12,
    textAlignVertical: "top",
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  gpsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
  },
  gpsLabel: { fontSize: 11, fontWeight: "800", color: "#0f766e" },
  gpsValue: { flex: 1, fontSize: 12, color: "#475569" },
  button: {
    backgroundColor: "#0f766e",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDanger: { backgroundColor: "#b91c1c" },
  buttonText: { color: "#ffffff", fontWeight: "800", fontSize: 16 },
  hint: { fontSize: 12, color: "#64748b", textAlign: "center", marginTop: 4 },
});
