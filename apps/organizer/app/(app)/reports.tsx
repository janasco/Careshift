import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { todayStr } from "@careshift/shared";

import {
  Badge,
  Card,
  EmptyState,
  ErrorNotice,
  Loading,
  ProgressBar,
  Screen,
  SectionTitle,
  StatCard,
} from "@/components/ui";
import { apiGet } from "@/lib/api";
import { addDays, formatShortDate, dayKey } from "@/lib/format";
import type { DailyReport } from "@/lib/types";
import { colors, radius } from "@/lib/theme";

export default function ReportsScreen() {
  const [date, setDate] = useState(todayStr());

  const report = useQuery({
    queryKey: ["report", "daily", date],
    queryFn: () => apiGet<DailyReport>(`/api/reports/daily?date=${date}`),
  });

  const move = (days: number) => {
    const current = new Date(`${date}T12:00:00`);
    setDate(dayKey(addDays(current, days)));
  };

  return (
    <Screen refreshing={report.isRefetching} onRefresh={() => report.refetch()}>
      <View style={styles.header}>
        <Text style={styles.title}>Daily report</Text>
        <Text style={styles.subtitle}>
          Completion, missed tasks, and notes for any day.
        </Text>
      </View>

      <Card>
        <View style={styles.dateRow}>
          <Pressable onPress={() => move(-1)} style={styles.dateButton}>
            <Text style={styles.dateButtonText}>‹</Text>
          </Pressable>
          <View style={{ alignItems: "center" }}>
            <Text style={styles.dateLabel}>{formatShortDate(date)}</Text>
            {date !== todayStr() ? (
              <Pressable onPress={() => setDate(todayStr())}>
                <Text style={styles.todayLink}>Back to today</Text>
              </Pressable>
            ) : (
              <Text style={styles.todayHint}>Today</Text>
            )}
          </View>
          <Pressable onPress={() => move(1)} style={styles.dateButton}>
            <Text style={styles.dateButtonText}>›</Text>
          </Pressable>
        </View>
      </Card>

      {report.isLoading ? <Loading label="Building report…" /> : null}
      {report.isError ? (
        <ErrorNotice
          message={
            report.error instanceof Error ? report.error.message : "Could not load report."
          }
          onRetry={() => report.refetch()}
        />
      ) : null}

      {report.data ? (
        <>
          <View style={styles.statRow}>
            <StatCard
              label="Completion"
              value={`${report.data.completionRate}%`}
              hint={`${report.data.completed}/${report.data.total} tasks`}
            />
            <StatCard
              label="Missed"
              value={report.data.overdue}
              hint={report.data.overdue > 0 ? "Past due" : "Nothing missed"}
              tone={report.data.overdue > 0 ? "red" : "teal"}
            />
          </View>
          <View style={styles.statRow}>
            <StatCard
              label="Pending"
              value={report.data.pending}
              tone="amber"
              hint="Not completed yet"
            />
            <StatCard
              label="Issues"
              value={report.data.issuesCount}
              tone={report.data.issuesCount > 0 ? "red" : "teal"}
              hint="Reported by team"
            />
          </View>

          <SectionTitle title="By care team member" />
          {report.data.byCaregiver.length === 0 ? (
            <EmptyState
              title="No care activity"
              message="There were no tasks assigned on this date."
            />
          ) : (
            <Card>
              {report.data.byCaregiver.map((member, index) => (
                <View
                  key={member.caregiverId}
                  style={[styles.member, index > 0 && styles.memberBorder]}
                >
                  <View style={styles.memberHead}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <Badge
                      label={`${member.rate}%`}
                      tone={
                        member.rate >= 90
                          ? "green"
                          : member.rate >= 60
                            ? "amber"
                            : "red"
                      }
                    />
                  </View>
                  <ProgressBar value={member.rate} />
                  <Text style={styles.memberMeta}>
                    {member.completed}/{member.total} done
                    {member.missed > 0 ? ` · ${member.missed} missed` : ""}
                    {member.issues > 0 ? ` · ${member.issues} issues` : ""}
                  </Text>
                </View>
              ))}
            </Card>
          )}

          <SectionTitle title="Care notes" hint="Notes attached to completed tasks" />
          {report.data.notes.length === 0 ? (
            <EmptyState
              title="No notes for this date"
              message="Task notes will appear here when the care team adds them."
            />
          ) : (
            report.data.notes.map((note) => (
              <Card key={note.taskId}>
                <Text style={styles.noteTask}>{note.taskName}</Text>
                <Text style={styles.noteText}>{note.note}</Text>
                <Text style={styles.noteMeta}>{note.caregiverName}</Text>
              </Card>
            ))
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  title: { fontSize: 22, fontWeight: "900", color: colors.text },
  subtitle: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateButtonText: { fontSize: 24, color: colors.primaryDark, marginTop: -2 },
  dateLabel: { fontSize: 16, fontWeight: "800", color: colors.text },
  todayLink: { fontSize: 11, color: colors.primary, fontWeight: "700", marginTop: 2 },
  todayHint: { fontSize: 11, color: colors.subtle, marginTop: 2 },
  statRow: { flexDirection: "row", gap: 10 },
  member: { gap: 6 },
  memberBorder: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  memberHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  memberName: { fontSize: 14, fontWeight: "800", color: colors.text },
  memberMeta: { fontSize: 11, color: colors.muted },
  noteTask: { fontSize: 13, fontWeight: "800", color: colors.text },
  noteText: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  noteMeta: { fontSize: 11, color: colors.subtle },
});
