import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { formatTimeLabel } from "@careshift/shared";

import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  Loading,
  Row,
  Screen,
  SectionTitle,
} from "@/components/ui";
import { apiGet } from "@/lib/api";
import {
  addDays,
  ageFromDob,
  dayKey,
  endOfDay,
  formatDateTime,
  formatShortDate,
  startOfDay,
} from "@/lib/format";
import type {
  CalendarEvent,
  CareEvent,
  Medication,
  Patient,
} from "@/lib/types";
import { colors } from "@/lib/theme";

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const patient = useQuery({
    queryKey: ["patient", id],
    queryFn: () => apiGet<Patient>(`/api/patients/${id}`),
    enabled: Boolean(id),
  });
  const meds = useQuery({
    queryKey: ["medications"],
    queryFn: () => apiGet<Medication[]>("/api/medications"),
  });
  const events = useQuery({
    queryKey: ["care-events", "patient", id],
    queryFn: () => apiGet<CareEvent[]>(`/api/care-events?patientId=${id}`),
    enabled: Boolean(id),
  });
  const calendar = useQuery({
    queryKey: ["calendar", "patient", id],
    queryFn: () =>
      apiGet<CalendarEvent[]>(
        `/api/calendar?fromMs=${startOfDay().getTime()}&toMs=${endOfDay(addDays(new Date(), 30)).getTime()}`,
      ),
    enabled: Boolean(id),
  });

  if (patient.isLoading) return <Loading label="Loading care recipient…" />;
  if (patient.isError || !patient.data) {
    return (
      <Screen>
        <ErrorNotice
          message={
            patient.error instanceof Error
              ? patient.error.message
              : "Could not load this care recipient."
          }
          onRetry={() => patient.refetch()}
        />
      </Screen>
    );
  }

  const data = patient.data;
  const age = ageFromDob(data.dateOfBirth);
  const patientMeds = (meds.data ?? []).filter(
    (medication) => medication.patientId === data.id,
  );
  const patientEvents = events.data ?? [];
  const appointments = (calendar.data ?? []).filter(
    (event) => event.patientId === data.id,
  );

  return (
    <>
      <Stack.Screen options={{ title: data.fullName }} />
      <Screen
        refreshing={
          patient.isRefetching || meds.isRefetching || events.isRefetching
        }
        onRefresh={() => {
          void patient.refetch();
          void meds.refetch();
          void events.refetch();
          void calendar.refetch();
        }}
      >
        <Card>
          <View style={styles.head}>
            <Avatar name={data.fullName} tone="violet" />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{data.fullName}</Text>
              <Text style={styles.meta}>
                {[
                  data.preferredName,
                  age != null ? `${age} years old` : null,
                  data.dateOfBirth,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Care recipient"}
              </Text>
            </View>
            <Badge
              label={data.status}
              tone={data.status === "active" ? "green" : "slate"}
            />
          </View>
          <View style={styles.actions}>
            <Button
              title="Add medication"
              variant="secondary"
              onPress={() => router.push("/(app)/medications/new")}
              style={{ flex: 1 }}
            />
            <Button
              title="Journal note"
              onPress={() =>
                router.push({
                  pathname: "/(app)/journal",
                  params: { patientId: data.id, compose: "1" },
                })
              }
              style={{ flex: 1 }}
            />
          </View>
        </Card>

        <SectionTitle title="Care plan" />
        <Card>
          <Row label="Preferred name" value={data.preferredName} />
          <Row label="Date of birth" value={data.dateOfBirth} />
          <Row label="Primary contact" value={data.primaryContactName} />
          <Row label="Contact phone" value={data.primaryContactPhone} />
          <Row label="Address" value={data.address} />
          {data.notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Care notes</Text>
              <Text style={styles.notesText}>{data.notes}</Text>
            </View>
          ) : null}
        </Card>

        <SectionTitle title="Medications" hint={`${patientMeds.length} active`} />
        {patientMeds.length === 0 ? (
          <EmptyState
            title="No medications"
            message="Add this care recipient's medication schedule to start tracking doses."
          />
        ) : (
          patientMeds.map((medication) => (
            <Card key={medication.id}>
              <View style={styles.medHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.medName}>{medication.name}</Text>
                  <Text style={styles.meta}>
                    {medication.dosage ?? "No dosage"} ·{" "}
                    {medication.frequency ?? "As scheduled"}
                  </Text>
                </View>
                {medication.lowStock ? <Badge label="Low stock" tone="amber" /> : null}
              </View>
              <Text style={styles.times}>
                {medication.times.map(formatTimeLabel).join(" · ") || "No times set"}
              </Text>
              {medication.instructions ? (
                <Text style={styles.instructions}>{medication.instructions}</Text>
              ) : null}
            </Card>
          ))
        )}

        <SectionTitle title="Upcoming appointments" />
        {appointments.length === 0 ? (
          <EmptyState
            title="Nothing booked"
            message="Add appointments from the shared calendar so the whole team knows."
          />
        ) : (
          appointments.map((event) => (
            <Card key={event.id}>
              <Text style={styles.appointmentDate}>
                {formatShortDate(dayKey(new Date(event.startMs)))}
              </Text>
              <Text style={styles.appointmentTitle}>{event.title}</Text>
              <Text style={styles.meta}>
                {formatDateTime(event.startMs)}
                {event.location ? ` · ${event.location}` : ""}
              </Text>
            </Card>
          ))
        )}

        <SectionTitle title="Recent journal" hint="Latest care notes" />
        {patientEvents.length === 0 ? (
          <EmptyState
            title="No journal entries"
            message="Observations and health notes for this care recipient will appear here."
          />
        ) : (
          patientEvents.slice(0, 6).map((event) => (
            <Card key={event.id}>
              <View style={styles.eventHead}>
                <Badge label={event.eventType} tone="teal" />
                <Text style={styles.eventTime}>
                  {formatDateTime(event.occurredAt ?? event.createdAt)}
                </Text>
              </View>
              <Text style={styles.eventNotes}>{event.notes}</Text>
              <Text style={styles.eventMeta}>
                {event.caregiverName ?? "Care team"}
              </Text>
            </Card>
          ))
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontSize: 19, fontWeight: "900", color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  actions: { flexDirection: "row", gap: 8, marginTop: 4 },
  notesBox: {
    backgroundColor: colors.bg,
    borderRadius: 12,
    padding: 12,
    gap: 3,
  },
  notesLabel: { fontSize: 11, fontWeight: "800", color: colors.muted },
  notesText: { fontSize: 13, color: colors.text, lineHeight: 19 },
  medHead: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  medName: { fontSize: 15, fontWeight: "800", color: colors.text },
  times: { fontSize: 12, color: colors.primaryDark, fontWeight: "700" },
  instructions: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  appointmentDate: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  appointmentTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  eventHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eventTime: { fontSize: 10, color: colors.subtle },
  eventNotes: { fontSize: 13, color: colors.text, lineHeight: 19 },
  eventMeta: { fontSize: 11, color: colors.muted },
});
