import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import {
  Badge,
  Button,
  Card,
  Chips,
  EmptyState,
  ErrorNotice,
  Field,
  Loading,
  Screen,
  Sheet,
} from "@/components/ui";
import { apiGet, apiPost } from "@/lib/api";
import { formatDateTime, relativeTime } from "@/lib/format";
import type { CareEvent, PatientOption } from "@/lib/types";
import { colors } from "@/lib/theme";

const EVENT_TYPES = ["Observation", "Note", "Concern", "Medication given", "Pain", "Other"];

const TYPE_TONE: Record<string, "teal" | "amber" | "red" | "blue" | "violet" | "slate"> = {
  Observation: "teal",
  Note: "blue",
  Concern: "amber",
  "Medication given": "violet",
  Pain: "red",
  Other: "slate",
};

export default function JournalScreen() {
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ patientId?: string; compose?: string }>();
  const [compose, setCompose] = useState(false);
  const [patientId, setPatientId] = useState("none");
  const [eventType, setEventType] = useState("Observation");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (params.compose === "1") {
      setCompose(true);
      if (params.patientId) setPatientId(params.patientId);
    }
  }, [params.compose, params.patientId]);

  const events = useQuery({
    queryKey: ["care-events"],
    queryFn: () => apiGet<CareEvent[]>("/api/care-events"),
    refetchInterval: 30_000,
  });
  const patients = useQuery({
    queryKey: ["patient-options"],
    queryFn: () => apiGet<PatientOption[]>("/api/patient-options"),
  });

  const create = useMutation({
    mutationFn: () => {
      if (!notes.trim()) throw new Error("Write a note for the care team.");
      return apiPost("/api/care-events", {
        patientId: patientId === "none" ? undefined : patientId,
        eventType,
        notes: notes.trim(),
        occurredAt: Date.now(),
      });
    },
    onSuccess: async () => {
      setCompose(false);
      setNotes("");
      await queryClient.invalidateQueries({ queryKey: ["care-events"] });
      await queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
    onError: (error) => {
      Alert.alert(
        "Could not save note",
        error instanceof Error ? error.message : "Try again.",
      );
    },
  });

  if (events.isLoading) return <Loading label="Loading care journal…" />;
  if (events.isError) {
    return (
      <Screen>
        <ErrorNotice
          message={
            events.error instanceof Error ? events.error.message : "Could not load journal."
          }
          onRetry={() => events.refetch()}
        />
      </Screen>
    );
  }

  return (
    <>
      <Screen refreshing={events.isRefetching} onRefresh={() => events.refetch()}>
        <View style={styles.header}>
          <Text style={styles.title}>Care journal</Text>
          <Text style={styles.subtitle}>
            A running record of observations, health notes, and care updates
            that every family member can reference.
          </Text>
        </View>
        <Button title="+ Add journal note" onPress={() => setCompose(true)} />

        {(events.data ?? []).length === 0 ? (
          <EmptyState
            title="The journal is empty"
            message="Log the first observation so the whole care team has the same picture."
          />
        ) : (
          (events.data ?? []).map((event) => (
            <Card key={event.id}>
              <View style={styles.eventHead}>
                <Badge
                  label={event.eventType}
                  tone={TYPE_TONE[event.eventType] ?? "slate"}
                />
                <Text style={styles.eventTime}>
                  {relativeTime(event.createdAt)}
                </Text>
              </View>
              <Text style={styles.eventNotes}>{event.notes}</Text>
              <Text style={styles.eventMeta}>
                {event.patientName ?? "All care"}
                {event.caregiverName ? ` · ${event.caregiverName}` : ""}
                {event.occurredAt ? ` · ${formatDateTime(event.occurredAt)}` : ""}
              </Text>
            </Card>
          ))
        )}
      </Screen>

      <Sheet visible={compose} title="Add journal note" onClose={() => setCompose(false)}>
        <Text style={styles.label}>For</Text>
        <Chips
          options={[
            { label: "All care", value: "none" },
            ...(patients.data ?? []).map((patient) => ({
              label: patient.preferredName || patient.fullName,
              value: patient.id,
            })),
          ]}
          value={patientId}
          onChange={setPatientId}
        />
        <Text style={styles.label}>Type</Text>
        <Chips
          options={EVENT_TYPES.map((type) => ({ label: type, value: type }))}
          value={eventType}
          onChange={setEventType}
        />
        <Field
          label="Note"
          value={notes}
          onChangeText={setNotes}
          placeholder="What did you observe? Meals, mood, sleep, pain, skin, or anything the team should know."
          multiline
        />
        <Button
          title="Save note"
          loading={create.isPending}
          onPress={() => create.mutate()}
        />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  title: { fontSize: 22, fontWeight: "900", color: colors.text },
  subtitle: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  eventHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eventTime: { fontSize: 11, color: colors.subtle },
  eventNotes: { fontSize: 14, color: colors.text, lineHeight: 20 },
  eventMeta: { fontSize: 11, color: colors.muted },
  label: { fontSize: 12, fontWeight: "700", color: colors.muted },
});
