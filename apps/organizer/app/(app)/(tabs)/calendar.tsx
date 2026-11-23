import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  Loading,
  Screen,
  Sheet,
} from "@/components/ui";
import { apiDelete, apiGet } from "@/lib/api";
import {
  addDays,
  dayKey,
  endOfDay,
  formatClock,
  formatDayHeading,
  formatTimeRange,
  startOfDay,
} from "@/lib/format";
import type { CalendarEvent } from "@/lib/types";
import { colors } from "@/lib/theme";

const TYPE_TONE: Record<string, "violet" | "teal" | "blue" | "amber" | "slate"> = {
  appointment: "violet",
  visit: "teal",
  medication: "blue",
  reminder: "amber",
  other: "slate",
};

export default function CalendarScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<CalendarEvent | null>(null);

  const from = startOfDay().getTime();
  const to = endOfDay(addDays(new Date(), 30)).getTime();

  const events = useQuery({
    queryKey: ["calendar", "month", from, to],
    queryFn: () =>
      apiGet<CalendarEvent[]>(`/api/calendar?fromMs=${from}&toMs=${to}`),
    refetchInterval: 60_000,
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/calendar/${id}`),
    onSuccess: async () => {
      setSelected(null);
      await queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (error) => {
      Alert.alert(
        "Could not delete",
        error instanceof Error ? error.message : "Try again.",
      );
    },
  });

  const confirmDelete = (event: CalendarEvent) => {
    Alert.alert("Delete event?", event.title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => remove.mutate(event.id),
      },
    ]);
  };

  if (events.isLoading) return <Loading label="Loading calendar…" />;
  if (events.isError) {
    return (
      <Screen>
        <ErrorNotice
          message={
            events.error instanceof Error ? events.error.message : "Could not load calendar."
          }
          onRetry={() => events.refetch()}
        />
      </Screen>
    );
  }

  const grouped = new Map<string, CalendarEvent[]>();
  for (const event of events.data ?? []) {
    const key = dayKey(new Date(event.startMs));
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  }

  return (
    <>
      <Screen refreshing={events.isRefetching} onRefresh={() => events.refetch()}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Shared care calendar</Text>
            <Text style={styles.subtitle}>
              Doctor appointments, family visits, and reminders — visible to the
              whole care team.
            </Text>
          </View>
        </View>
        <Button
          title="+ New appointment"
          onPress={() => router.push("/(app)/appointments/new")}
        />

        {(events.data ?? []).length === 0 ? (
          <EmptyState
            title="Nothing scheduled"
            message="Add the next doctor appointment, family visit, or medication reminder."
          />
        ) : (
          Array.from(grouped.entries()).map(([key, list]) => (
            <View key={key} style={{ gap: 8 }}>
              <Text style={styles.day}>
                {formatDayHeading(new Date(`${key}T12:00:00`))}
              </Text>
              {list.map((event) => (
                <Card key={event.id} onPress={() => setSelected(event)}>
                  <View style={styles.eventHead}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={styles.eventTime}>
                        {event.allDay
                          ? "All day"
                          : formatTimeRange(event.startMs, event.endMs)}
                      </Text>
                      <Text style={styles.eventTitle}>{event.title}</Text>
                      <Text style={styles.eventMeta}>
                        {event.patientName ?? "All care"}
                        {event.location ? ` · ${event.location}` : ""}
                      </Text>
                    </View>
                    <Badge
                      label={event.eventType}
                      tone={TYPE_TONE[event.eventType] ?? "slate"}
                    />
                  </View>
                  {event.notes ? (
                    <Text style={styles.eventNotes} numberOfLines={2}>
                      {event.notes}
                    </Text>
                  ) : null}
                </Card>
              ))}
            </View>
          ))
        )}
      </Screen>

      <Sheet
        visible={Boolean(selected)}
        title={selected?.title ?? "Event"}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <>
            <Card>
              <Text style={styles.detailTime}>
                {selected.allDay
                  ? "All day"
                  : formatTimeRange(selected.startMs, selected.endMs)}
              </Text>
              <Text style={styles.detailMeta}>
                {selected.patientName ?? "All care"}
              </Text>
              {selected.location ? (
                <Text style={styles.detailMeta}>{selected.location}</Text>
              ) : null}
              {selected.notes ? (
                <Text style={styles.detailNotes}>{selected.notes}</Text>
              ) : null}
              {selected.createdByName ? (
                <Text style={styles.detailSmall}>
                  Added by {selected.createdByName} ·{" "}
                  {formatClock(selected.createdAt)}
                </Text>
              ) : null}
            </Card>
            <Button
              title="Delete event"
              variant="danger"
              loading={remove.isPending}
              onPress={() => confirmDelete(selected)}
            />
          </>
        ) : null}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", gap: 10 },
  title: { fontSize: 22, fontWeight: "900", color: colors.text },
  subtitle: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 4 },
  day: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.primaryDark,
    marginTop: 8,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  eventHead: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  eventTime: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  eventTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  eventMeta: { fontSize: 12, color: colors.muted },
  eventNotes: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  detailTime: { fontSize: 15, fontWeight: "800", color: colors.primaryDark },
  detailMeta: { fontSize: 13, color: colors.muted },
  detailNotes: { fontSize: 14, color: colors.text, lineHeight: 20, marginTop: 4 },
  detailSmall: { fontSize: 11, color: colors.subtle, marginTop: 4 },
});
