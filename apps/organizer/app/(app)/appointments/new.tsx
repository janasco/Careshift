import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { todayStr } from "@careshift/shared";

import { Button, Card, Chips, Field, Screen } from "@/components/ui";
import { apiGet, apiPost } from "@/lib/api";
import type { PatientOption } from "@/lib/types";
import { colors } from "@/lib/theme";

const EVENT_TYPES = [
  { label: "Appointment", value: "appointment" },
  { label: "Family visit", value: "visit" },
  { label: "Reminder", value: "reminder" },
  { label: "Medication", value: "medication" },
  { label: "Other", value: "other" },
] as const;

const DURATIONS = [
  { label: "30 min", value: "30" },
  { label: "1 hour", value: "60" },
  { label: "90 min", value: "90" },
  { label: "2 hours", value: "120" },
] as const;

export default function NewAppointmentScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const now = new Date();
  const nextHour = Math.min(now.getHours() + 1, 23);

  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<string>("appointment");
  const [patientId, setPatientId] = useState("all");
  const [date, setDate] = useState(todayStr());
  const [startTime, setStartTime] = useState(
    `${String(nextHour).padStart(2, "0")}:00`,
  );
  const [duration, setDuration] = useState("60");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const patients = useQuery({
    queryKey: ["patient-options"],
    queryFn: () => apiGet<PatientOption[]>("/api/patient-options"),
  });

  const create = useMutation({
    mutationFn: () => {
      const startMs = new Date(`${date}T${startTime}:00`).getTime();
      if (!title.trim()) throw new Error("Add a title for the appointment.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error("Use a date like 2026-11-23.");
      }
      if (!/^\d{1,2}:\d{2}$/.test(startTime)) {
        throw new Error("Use a time like 09:00 or 14:30.");
      }
      if (!Number.isFinite(startMs)) throw new Error("That date and time looks invalid.");
      return apiPost("/api/calendar", {
        title: title.trim(),
        eventType,
        patientId: patientId === "all" ? null : patientId,
        startMs,
        endMs: startMs + Number(duration) * 60_000,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["calendar"] });
      router.back();
    },
    onError: (error) => {
      Alert.alert(
        "Could not save",
        error instanceof Error ? error.message : "Try again.",
      );
    },
  });

  return (
    <Screen>
      <Card>
        <Field
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Doctor check-up"
        />
        <Text style={styles.label}>Type</Text>
        <Chips
          options={EVENT_TYPES.map((item) => ({ ...item }))}
          value={eventType}
          onChange={setEventType}
        />
        <Text style={styles.label}>For</Text>
        <Chips
          options={[
            { label: "All care", value: "all" },
            ...(patients.data ?? []).map((patient) => ({
              label: patient.preferredName || patient.fullName,
              value: patient.id,
            })),
          ]}
          value={patientId}
          onChange={setPatientId}
        />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field
              label="Date"
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Start time"
              value={startTime}
              onChangeText={setStartTime}
              placeholder="HH:MM"
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>
        <Text style={styles.label}>Duration</Text>
        <Chips
          options={DURATIONS.map((item) => ({ ...item }))}
          value={duration}
          onChange={setDuration}
        />
        <Field
          label="Location"
          value={location}
          onChangeText={setLocation}
          placeholder="e.g. City Clinic, Room 204"
        />
        <Field
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="What should the care team bring or prepare?"
          multiline
        />
      </Card>
      <Button
        title="Save appointment"
        loading={create.isPending}
        onPress={() => create.mutate()}
      />
      <Text style={styles.hint}>
        Appointments appear on the shared calendar for the whole care team.
      </Text>
    </Screen>
  );
}

const styles = {
  label: { fontSize: 12, fontWeight: "700" as const, color: colors.muted },
  row: { flexDirection: "row" as const, gap: 10 },
  hint: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center" as const,
    lineHeight: 17,
  },
};
