import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatTimeLabel, todayStr } from "@careshift/shared";

import { apiGet, apiPost } from "@/lib/api";

type DoseLog = {
  _id: string;
  status: "taken" | "skipped" | "missed";
  takenAt?: number | null;
  skipReason?: string | null;
};

type Dose = {
  time: string;
  log: DoseLog | null;
};

type Medication = {
  _id: string;
  name: string;
  dosage?: string | null;
  route?: string | null;
  instructions?: string | null;
  patientName: string;
  times: string[];
  doses: Dose[];
  stock?: number | null;
  refillThreshold?: number | null;
  lowStock?: boolean;
};

export default function MedicationsScreen() {
  const today = todayStr();
  const queryClient = useQueryClient();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const medications = useQuery({
    queryKey: ["medication-doses", today],
    queryFn: () => apiGet<Medication[]>(`/api/medications/doses?date=${today}`),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["medication-doses", today] });

  const logDose = useMutation({
    mutationFn: (body: any) => apiPost("/api/medications/doses/log", body),
    onSuccess: invalidate,
  });
  const clearDose = useMutation({
    mutationFn: (body: any) => apiPost("/api/medications/doses/clear", body),
    onSuccess: invalidate,
  });

  const rows = (medications.data ?? [])
    .flatMap((medication) =>
      medication.doses.map((dose) => ({ medication, dose })),
    )
    .sort((a, b) => a.dose.time.localeCompare(b.dose.time));

  const taken = rows.filter((row) => row.dose.log?.status === "taken").length;
  const lowStock = (medications.data ?? []).filter((med) => med.lowStock);

  const markTaken = async (medication: Medication, time: string) => {
    const key = `${medication._id}-${time}`;
    setBusyKey(key);
    try {
      await logDose.mutateAsync({
        medicationId: medication._id,
        date: today,
        scheduledTime: time,
        status: "taken",
      });
    } catch (error) {
      Alert.alert(
        "Could not log dose",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setBusyKey(null);
    }
  };

  const skipDose = (medication: Medication, time: string, reason: string) => {
    Alert.alert("Skip dose", reason, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm skip",
        style: "destructive",
        onPress: async () => {
          const key = `${medication._id}-${time}`;
          setBusyKey(key);
          try {
            await logDose.mutateAsync({
              medicationId: medication._id,
              date: today,
              scheduledTime: time,
              status: "skipped",
              skipReason: reason,
            });
          } catch (error) {
            Alert.alert(
              "Could not skip dose",
              error instanceof Error ? error.message : "Please try again.",
            );
          } finally {
            setBusyKey(null);
          }
        },
      },
    ]);
  };

  const resetDose = async (medication: Medication, time: string) => {
    const key = `${medication._id}-${time}`;
    setBusyKey(key);
    try {
      await clearDose.mutateAsync({
        medicationId: medication._id,
        date: today,
        scheduledTime: time,
      });
    } catch (error) {
      Alert.alert(
        "Could not reset dose",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Today</Text>
          <Text style={styles.title}>Medications</Text>
          <Text style={styles.subtitle}>
            {taken}/{rows.length} doses given
          </Text>
        </View>

        {lowStock.length > 0 && (
          <View style={styles.warning}>
            <Text style={styles.warningText}>
              Low stock: {lowStock.map((med) => med.name).join(", ")}
            </Text>
          </View>
        )}

        {medications.isLoading && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#0f766e" />
          </View>
        )}

        {!medications.isLoading && rows.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No scheduled doses today</Text>
            <Text style={styles.emptyText}>
              Your supervisor can add medications and schedules on the website.
            </Text>
          </View>
        )}

        {rows.map(({ medication, dose }) => {
          const key = `${medication._id}-${dose.time}`;
          const log = dose.log;
          const overdue = !log && dose.time < new Date().toTimeString().slice(0, 5);
          return (
            <View key={key} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.time}>{formatTimeLabel(dose.time)}</Text>
                {log?.status === "taken" ? (
                  <Text style={[styles.badge, styles.badgeTaken]}>Taken</Text>
                ) : log?.status === "skipped" ? (
                  <Text style={[styles.badge, styles.badgeSkipped]}>Skipped</Text>
                ) : overdue ? (
                  <Text style={[styles.badge, styles.badgeOverdue]}>Overdue</Text>
                ) : (
                  <Text style={[styles.badge, styles.badgeDue]}>Due</Text>
                )}
              </View>
              <Text style={styles.medName}>
                {medication.name}
                {medication.dosage ? ` · ${medication.dosage}` : ""}
              </Text>
              <Text style={styles.meta}>
                {medication.patientName}
                {medication.route ? ` · ${medication.route}` : ""}
              </Text>
              {log?.skipReason ? (
                <Text style={styles.skipReason}>Reason: {log.skipReason}</Text>
              ) : null}
              {medication.instructions ? (
                <Text style={styles.instructions}>{medication.instructions}</Text>
              ) : null}

              <View style={styles.actions}>
                {!log ? (
                  <>
                    <Pressable
                      onPress={() => markTaken(medication, dose.time)}
                      disabled={busyKey === key}
                      style={({ pressed }) => [
                        styles.button,
                        styles.givenButton,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      {busyKey === key ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text style={styles.buttonText}>Given</Text>
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        skipDose(medication, dose.time, "Client refused")
                      }
                      disabled={busyKey === key}
                      style={({ pressed }) => [
                        styles.button,
                        styles.skipButton,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Text style={styles.skipText}>Skip</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    onPress={() => resetDose(medication, dose.time)}
                    disabled={busyKey === key}
                    style={({ pressed }) => [
                      styles.button,
                      styles.resetButton,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Text style={styles.resetText}>Reset</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  hero: {
    backgroundColor: "#0f766e",
    borderRadius: 18,
    padding: 18,
    gap: 4,
    marginBottom: 2,
  },
  eyebrow: { color: "#99f6e4", fontWeight: "700", fontSize: 12, textTransform: "uppercase" },
  title: { color: "#ffffff", fontWeight: "800", fontSize: 24 },
  subtitle: { color: "#ccfbf1", fontSize: 13 },
  warning: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  warningText: { color: "#b91c1c", fontSize: 13, fontWeight: "600" },
  loading: { paddingVertical: 40, alignItems: "center" },
  empty: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 6,
  },
  emptyTitle: { fontWeight: "700", color: "#0f172a" },
  emptyText: { color: "#64748b", textAlign: "center", fontSize: 13 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 4,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  time: { fontSize: 13, fontWeight: "800", color: "#0f766e" },
  badge: {
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: "700",
  },
  badgeTaken: { backgroundColor: "#dcfce7", color: "#166534" },
  badgeSkipped: { backgroundColor: "#e2e8f0", color: "#475569" },
  badgeDue: { backgroundColor: "#fef3c7", color: "#92400e" },
  badgeOverdue: { backgroundColor: "#fee2e2", color: "#b91c1c" },
  medName: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  meta: { fontSize: 12, color: "#64748b" },
  skipReason: { fontSize: 12, color: "#b45309", marginTop: 2 },
  instructions: { fontSize: 12, color: "#475569", marginTop: 2 },
  actions: { flexDirection: "row", gap: 8, marginTop: 8 },
  button: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  givenButton: { backgroundColor: "#0f766e" },
  skipButton: { backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#cbd5e1" },
  resetButton: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#cbd5e1" },
  buttonText: { color: "#ffffff", fontWeight: "700" },
  skipText: { color: "#334155", fontWeight: "700" },
  resetText: { color: "#475569", fontWeight: "700" },
});
