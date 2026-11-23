import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";
import { formatTimeLabel, todayStr } from "@careshift/shared";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  Loading,
  Screen,
  SectionTitle,
  StatCard,
} from "@/components/ui";
import { apiGet, apiPost } from "@/lib/api";
import { formatClock } from "@/lib/format";
import type { MedicationDoseRow } from "@/lib/types";
import { colors } from "@/lib/theme";

export default function MedicationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const date = todayStr();

  const meds = useQuery({
    queryKey: ["medication-doses", date],
    queryFn: () => apiGet<MedicationDoseRow[]>(`/api/medications/doses?date=${date}`),
    refetchInterval: 30_000,
  });

  const logDose = useMutation({
    mutationFn: (input: { medicationId: string; time: string }) =>
      apiPost("/api/medications/doses/log", {
        medicationId: input.medicationId,
        date,
        scheduledTime: input.time,
        status: "taken",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["medication-doses", date],
      });
    },
    onError: (error) => {
      Alert.alert(
        "Could not log dose",
        error instanceof Error ? error.message : "Try again.",
      );
    },
  });

  if (meds.isLoading) return <Loading label="Loading medications…" />;
  if (meds.isError) {
    return (
      <Screen>
        <ErrorNotice
          message={
            meds.error instanceof Error ? meds.error.message : "Could not load medications."
          }
          onRetry={() => meds.refetch()}
        />
      </Screen>
    );
  }

  const rows = meds.data ?? [];
  const doses = rows.flatMap((medication) =>
    medication.doses.map((dose) => ({ medication, dose })),
  );
  const taken = doses.filter((row) => row.dose.log?.status === "taken").length;
  const skipped = doses.filter((row) => row.dose.log?.status === "skipped").length;
  const overdue = doses.filter(
    (row) =>
      !row.dose.log &&
      new Date(`${date}T${row.dose.time}:00`).getTime() < Date.now(),
  ).length;
  const lowStock = rows.filter((row) => row.lowStock).length;

  return (
    <Screen refreshing={meds.isRefetching} onRefresh={() => meds.refetch()}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Medication tracking</Text>
          <Text style={styles.subtitle}>
            One tap confirms a dose for the whole care team.
          </Text>
        </View>
      </View>
      <Button
        title="+ Add medication"
        onPress={() => router.push("/(app)/medications/new")}
      />

      <View style={styles.statRow}>
        <StatCard
          label="Given today"
          value={`${taken}/${doses.length}`}
          hint={skipped > 0 ? `${skipped} skipped` : "all scheduled doses"}
          tone={overdue > 0 ? "red" : "teal"}
        />
        <StatCard
          label="Overdue"
          value={overdue}
          hint={overdue > 0 ? "Confirm or skip" : "Nothing overdue"}
          tone={overdue > 0 ? "red" : "teal"}
        />
      </View>
      <View style={styles.statRow}>
        <StatCard
          label="Low stock"
          value={lowStock}
          hint={lowStock > 0 ? "Plan a refill" : "Stock is healthy"}
          tone={lowStock > 0 ? "amber" : "teal"}
        />
        <StatCard
          label="Active meds"
          value={rows.length}
          hint="Across all care recipients"
          tone="violet"
        />
      </View>

      <SectionTitle title="Today's schedule" hint="Newest status first" />
      {rows.length === 0 ? (
        <EmptyState
          title="No medications yet"
          message="Add a medication with its dose times to start tracking adherence."
        />
      ) : (
        rows.map((medication) => (
          <Card key={medication.id}>
            <View style={styles.medHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.medName}>{medication.name}</Text>
                <Text style={styles.medMeta}>
                  {medication.dosage ?? "No dosage"} · {medication.patientName}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                {medication.lowStock ? <Badge label="Low stock" tone="amber" /> : null}
                {medication.stock != null ? (
                  <Text style={styles.stock}>{medication.stock} left</Text>
                ) : null}
              </View>
            </View>
            <View style={styles.doseList}>
              {medication.doses.map((dose) => {
                const log = dose.log;
                const dueMs = new Date(`${date}T${dose.time}:00`).getTime();
                const isOverdue = !log && dueMs < Date.now();
                return (
                  <View key={dose.time} style={styles.doseRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.doseTime}>{formatTimeLabel(dose.time)}</Text>
                      <Text style={styles.doseMeta}>
                        {log
                          ? log.status === "taken"
                            ? `Given${log.caregiverName ? ` by ${log.caregiverName}` : ""}`
                            : log.status === "skipped"
                              ? `Skipped${log.skipReason ? ` · ${log.skipReason}` : ""}`
                              : log.status
                          : isOverdue
                            ? "Overdue"
                            : "Due"}
                      </Text>
                    </View>
                    {log ? (
                      <Badge
                        label={log.status}
                        tone={
                          log.status === "taken"
                            ? "green"
                            : log.status === "skipped"
                              ? "amber"
                              : "red"
                        }
                      />
                    ) : (
                      <Button
                        title="Given"
                        variant={isOverdue ? "primary" : "secondary"}
                        loading={
                          logDose.isPending &&
                          logDose.variables?.medicationId === medication.id &&
                          logDose.variables?.time === dose.time
                        }
                        onPress={() =>
                          logDose.mutate({ medicationId: medication.id, time: dose.time })
                        }
                        style={styles.givenButton}
                      />
                    )}
                  </View>
                );
              })}
            </View>
            {medication.instructions ? (
              <Text style={styles.instructions}>{medication.instructions}</Text>
            ) : null}
            {!logDose.isPending && medication.doses.some((dose) => dose.log?.status === "taken") ? (
              <Text style={styles.lastGiven}>
                Last confirmed{" "}
                {formatClock(
                  medication.doses.find((dose) => dose.log?.status === "taken")?.log
                    ?.takenAt ?? Date.now(),
                )}
              </Text>
            ) : null}
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", gap: 10 },
  title: { fontSize: 22, fontWeight: "900", color: colors.text },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 3 },
  statRow: { flexDirection: "row", gap: 10 },
  medHead: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  medName: { fontSize: 16, fontWeight: "800", color: colors.text },
  medMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  stock: { fontSize: 11, color: colors.subtle },
  doseList: { gap: 8, marginTop: 2 },
  doseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  doseTime: { fontSize: 13, fontWeight: "700", color: colors.text },
  doseMeta: { fontSize: 11, color: colors.muted, marginTop: 1 },
  givenButton: { paddingVertical: 8, paddingHorizontal: 16 },
  instructions: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  lastGiven: { fontSize: 10, color: colors.subtle },
});
