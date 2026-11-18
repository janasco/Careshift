import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ComponentProps } from "react";
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
import { CARE_EVENT_TYPES } from "@careshift/shared";

import { apiGet, apiPost } from "@/lib/api";

type Patient = {
  id: string;
  fullName: string;
  preferredName?: string | null;
};

type Vital = {
  id: string;
  patientName?: string | null;
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
  patientName?: string | null;
  eventType: string;
  severity?: string | null;
  timeLabel?: string | null;
  notes: string;
  createdAt: number;
};

const SEVERITIES = ["low", "medium", "high"] as const;

export default function CareScreen() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"vitals" | "events">("vitals");
  const [patientId, setPatientId] = useState("");
  const [vitalForm, setVitalForm] = useState({
    bp: "",
    spo2: "",
    pulse: "",
    respiration: "",
    temperature: "",
    notes: "",
  });
  const [eventForm, setEventForm] = useState<{
    eventType: string;
    severity: string;
    notes: string;
  }>({
    eventType: CARE_EVENT_TYPES[0],
    severity: "low",
    notes: "",
  });

  const patients = useQuery({
    queryKey: ["patient-options"],
    queryFn: () => apiGet<Patient[]>("/api/patient-options"),
  });
  const vitals = useQuery({
    queryKey: ["vitals"],
    queryFn: () => apiGet<Vital[]>("/api/vitals"),
  });
  const events = useQuery({
    queryKey: ["care-events"],
    queryFn: () => apiGet<CareEvent[]>("/api/care-events"),
  });

  const selectedPatientId = patientId || patients.data?.[0]?.id || "";

  const createVital = useMutation({
    mutationFn: (body: any) => apiPost("/api/vitals", body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["vitals"] });
      setVitalForm({
        bp: "",
        spo2: "",
        pulse: "",
        respiration: "",
        temperature: "",
        notes: "",
      });
    },
  });
  const createEvent = useMutation({
    mutationFn: (body: any) => apiPost("/api/care-events", body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["care-events"] });
      setEventForm({
        eventType: CARE_EVENT_TYPES[0],
        severity: "low",
        notes: "",
      });
    },
  });

  const submitVital = async () => {
    if (!vitalForm.notes.trim()) {
      Alert.alert("Notes required", "Add a short observation for this reading.");
      return;
    }
    try {
      await createVital.mutateAsync({
        patientId: selectedPatientId || undefined,
        timeLabel: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        bp: vitalForm.bp.trim() || undefined,
        spo2: vitalForm.spo2 ? Number(vitalForm.spo2) : undefined,
        pulse: vitalForm.pulse ? Number(vitalForm.pulse) : undefined,
        respiration: vitalForm.respiration
          ? Number(vitalForm.respiration)
          : undefined,
        temperature: vitalForm.temperature.trim() || undefined,
        notes: vitalForm.notes,
        recordedAt: Date.now(),
      });
      Alert.alert("Reading saved", "The vital signs were added to the record.");
    } catch (error) {
      Alert.alert(
        "Could not save reading",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  const submitEvent = async () => {
    if (!eventForm.notes.trim()) {
      Alert.alert("Notes required", "Describe what happened.");
      return;
    }
    try {
      await createEvent.mutateAsync({
        patientId: selectedPatientId || undefined,
        eventType: eventForm.eventType,
        severity: eventForm.severity,
        timeLabel: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        occurredAt: Date.now(),
        notes: eventForm.notes,
      });
      Alert.alert("Care event saved");
    } catch (error) {
      Alert.alert(
        "Could not save event",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Caregiver entry</Text>
          <Text style={styles.title}>Patient care</Text>
          <Text style={styles.subtitle}>
            Vitals and everyday observations go straight to the care team.
          </Text>
        </View>

        <View style={styles.segment}>
          {(["vitals", "events"] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => setMode(value)}
              style={[styles.segmentButton, mode === value && styles.segmentActive]}
            >
              <Text
                style={[
                  styles.segmentText,
                  mode === value && styles.segmentTextActive,
                ]}
              >
                {value === "vitals" ? "Vital signs" : "Care log"}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Patient</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chips}>
            {(patients.data ?? []).map((patient) => (
              <Pressable
                key={patient.id}
                onPress={() => setPatientId(patient.id)}
                style={[
                  styles.chip,
                  selectedPatientId === patient.id && styles.chipActive,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedPatientId === patient.id && styles.chipTextActive,
                  ]}
                >
                  {patient.preferredName || patient.fullName}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {mode === "vitals" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Add vital signs</Text>
            <View style={styles.row}>
              <Field
                label="Blood pressure"
                value={vitalForm.bp}
                onChangeText={(bp) => setVitalForm({ ...vitalForm, bp })}
                placeholder="120/80"
              />
              <Field
                label="SpO₂ %"
                value={vitalForm.spo2}
                onChangeText={(spo2) => setVitalForm({ ...vitalForm, spo2 })}
                placeholder="97"
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.row}>
              <Field
                label="Pulse"
                value={vitalForm.pulse}
                onChangeText={(pulse) => setVitalForm({ ...vitalForm, pulse })}
                placeholder="80"
                keyboardType="number-pad"
              />
              <Field
                label="Respiration"
                value={vitalForm.respiration}
                onChangeText={(respiration) =>
                  setVitalForm({ ...vitalForm, respiration })
                }
                placeholder="18"
                keyboardType="number-pad"
              />
            </View>
            <Field
              label="Temperature"
              value={vitalForm.temperature}
              onChangeText={(temperature) =>
                setVitalForm({ ...vitalForm, temperature })
              }
              placeholder="36.8 °C"
            />
            <Field
              label="Notes"
              value={vitalForm.notes}
              onChangeText={(notes) => setVitalForm({ ...vitalForm, notes })}
              placeholder="Observations, interventions, concerns…"
              multiline
            />
            <Pressable
              onPress={submitVital}
              disabled={createVital.isPending}
              style={({ pressed }) => [
                styles.saveButton,
                pressed && { opacity: 0.8 },
              ]}
            >
              {createVital.isPending ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveText}>Save reading</Text>
              )}
            </Pressable>

            <Text style={styles.listTitle}>Recent readings</Text>
            {vitals.isLoading && <ActivityIndicator color="#0f766e" />}
            {(vitals.data ?? []).slice(0, 8).map((vital) => (
              <View key={vital.id} style={styles.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listMain}>
                    {vital.bp ?? "No BP"} · SpO₂ {vital.spo2 ?? "—"}% · PR{" "}
                    {vital.pulse ?? "—"}
                  </Text>
                  <Text style={styles.listMeta}>
                    {vital.patientName ?? "Unspecified"} ·{" "}
                    {vital.timeLabel ??
                      new Date(vital.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                  </Text>
                </View>
                <Text style={styles.listTemp}>{vital.temperature ?? "—"}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Add care event</Text>
            <Text style={styles.label}>Event type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chips}>
                {CARE_EVENT_TYPES.map((type) => (
                  <Pressable
                    key={type}
                    onPress={() => setEventForm({ ...eventForm, eventType: type })}
                    style={[
                      styles.chip,
                      eventForm.eventType === type && styles.chipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        eventForm.eventType === type && styles.chipTextActive,
                      ]}
                    >
                      {type}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.label}>Severity</Text>
            <View style={styles.chips}>
              {SEVERITIES.map((severity) => (
                <Pressable
                  key={severity}
                  onPress={() => setEventForm({ ...eventForm, severity })}
                  style={[
                    styles.chip,
                    eventForm.severity === severity && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      eventForm.severity === severity && styles.chipTextActive,
                    ]}
                  >
                    {severity}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Field
              label="Notes"
              value={eventForm.notes}
              onChangeText={(notes) => setEventForm({ ...eventForm, notes })}
              placeholder="What happened, output, intervention…"
              multiline
            />
            <Pressable
              onPress={submitEvent}
              disabled={createEvent.isPending}
              style={({ pressed }) => [
                styles.saveButton,
                pressed && { opacity: 0.8 },
              ]}
            >
              {createEvent.isPending ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveText}>Save care event</Text>
              )}
            </Pressable>

            <Text style={styles.listTitle}>Recent events</Text>
            {events.isLoading && <ActivityIndicator color="#0f766e" />}
            {(events.data ?? []).slice(0, 8).map((event) => (
              <View key={event.id} style={styles.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listMain}>{event.eventType}</Text>
                  <Text style={styles.listMeta}>
                    {event.patientName ?? "Unspecified"} ·{" "}
                    {event.timeLabel ??
                      new Date(event.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                  </Text>
                </View>
                <Text style={styles.listTemp}>{event.severity ?? "—"}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  ...props
}: {
  label: string;
} & ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor="#94a3b8"
        style={[styles.input, props.multiline && styles.inputMultiline]}
      />
    </View>
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
  },
  eyebrow: { color: "#99f6e4", fontWeight: "700", fontSize: 12, textTransform: "uppercase" },
  title: { color: "#ffffff", fontWeight: "800", fontSize: 24 },
  subtitle: { color: "#ccfbf1", fontSize: 13, lineHeight: 18 },
  segment: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segmentButton: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center" },
  segmentActive: { backgroundColor: "#ffffff" },
  segmentText: { color: "#475569", fontWeight: "700", fontSize: 13 },
  segmentTextActive: { color: "#0f766e" },
  label: { fontSize: 12, fontWeight: "600", color: "#334155", marginTop: 4 },
  chips: { flexDirection: "row", gap: 6, paddingVertical: 4 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#ffffff",
  },
  chipActive: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  chipText: { fontSize: 12, color: "#475569", fontWeight: "600" },
  chipTextActive: { color: "#ffffff" },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  row: { flexDirection: "row", gap: 8 },
  field: { flex: 1, gap: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  inputMultiline: { minHeight: 76, textAlignVertical: "top" },
  saveButton: {
    backgroundColor: "#0f766e",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 4,
  },
  saveText: { color: "#ffffff", fontWeight: "800" },
  listTitle: { fontSize: 13, fontWeight: "800", color: "#0f172a", marginTop: 10 },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingVertical: 8,
  },
  listMain: { fontSize: 13, fontWeight: "600", color: "#0f172a" },
  listMeta: { fontSize: 11, color: "#64748b", marginTop: 1 },
  listTemp: { fontSize: 11, color: "#0f766e", fontWeight: "700" },
});
