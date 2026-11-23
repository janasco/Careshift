import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { formatTimeLabel, todayStr } from "@careshift/shared";

import {
  Badge,
  Card,
  Chips,
  EmptyState,
  ErrorNotice,
  Loading,
  Screen,
  SectionTitle,
  StatCard,
} from "@/components/ui";
import { apiGet } from "@/lib/api";
import type { Task } from "@/lib/types";
import { colors } from "@/lib/theme";

type Filter = "all" | "pending" | "done" | "issues";

export default function TasksScreen() {
  const date = todayStr();
  const [filter, setFilter] = useState<Filter>("all");

  const tasks = useQuery({
    queryKey: ["tasks", "admin", date],
    queryFn: () => apiGet<Task[]>(`/api/tasks/admin?date=${date}`),
    refetchInterval: 30_000,
  });

  if (tasks.isLoading) return <Loading label="Loading tasks…" />;
  if (tasks.isError) {
    return (
      <Screen>
        <ErrorNotice
          message={
            tasks.error instanceof Error ? tasks.error.message : "Could not load tasks."
          }
          onRetry={() => tasks.refetch()}
        />
      </Screen>
    );
  }

  const rows = tasks.data ?? [];
  const done = rows.filter((task) => task.status === "completed").length;
  const issues = rows.filter((task) => task.status === "completed_with_issue").length;
  const overdue = rows.filter(
    (task) => task.status === "pending" && task.dueMs < Date.now(),
  ).length;

  const filtered = rows.filter((task) => {
    if (filter === "pending") return task.status === "pending";
    if (filter === "done") return task.status === "completed";
    if (filter === "issues") return task.status === "completed_with_issue";
    return true;
  });

  return (
    <Screen refreshing={tasks.isRefetching} onRefresh={() => tasks.refetch()}>
      <View style={styles.header}>
        <Text style={styles.title}>Task board</Text>
        <Text style={styles.subtitle}>
          Who is doing what today, and what still needs a hand.
        </Text>
      </View>

      <View style={styles.statRow}>
        <StatCard label="Tasks" value={rows.length} hint={`${done} completed`} />
        <StatCard
          label="Overdue"
          value={overdue}
          hint={overdue > 0 ? "Needs attention" : "On track"}
          tone={overdue > 0 ? "red" : "teal"}
        />
      </View>
      <View style={styles.statRow}>
        <StatCard label="With issue" value={issues} tone="amber" hint="Reported by team" />
        <StatCard
          label="Completion"
          value={`${rows.length ? Math.round((done / rows.length) * 100) : 0}%`}
          tone="violet"
          hint="Today so far"
        />
      </View>

      <Chips
        options={[
          { label: "All", value: "all" },
          { label: "Pending", value: "pending" },
          { label: "Done", value: "done" },
          { label: "Issues", value: "issues" },
        ]}
        value={filter}
        onChange={setFilter}
      />

      <SectionTitle title="Today's tasks" hint={`${filtered.length} shown`} />
      {filtered.length === 0 ? (
        <EmptyState
          title="No tasks in this view"
          message="Tasks are generated from assignments. Change the filter or add a recurring task from the web console."
        />
      ) : (
        filtered
          .slice()
          .sort((a, b) => a.dueMs - b.dueMs)
          .map((task) => {
            const isOverdue = task.status === "pending" && task.dueMs < Date.now();
            const label =
              task.status === "completed_with_issue"
                ? "Issue"
                : task.status === "completed"
                  ? "Done"
                  : isOverdue
                    ? "Overdue"
                    : "Pending";
            const tone =
              task.status === "completed"
                ? "green"
                : task.status === "completed_with_issue"
                  ? "red"
                  : isOverdue
                    ? "red"
                    : "amber";
            return (
              <Card key={task.id}>
                <View style={styles.taskHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.taskName}>{task.taskName}</Text>
                    <Text style={styles.taskMeta}>
                      {task.patientName} · {task.caregiverName}
                    </Text>
                  </View>
                  <Badge label={label} tone={tone} />
                </View>
                <View style={styles.taskFooter}>
                  <Text style={styles.taskTime}>
                    {formatTimeLabel(task.scheduledTime)} · {task.shiftName}
                  </Text>
                  <Text style={styles.taskCategory}>{task.category}</Text>
                </View>
                {task.note ? (
                  <Text style={styles.taskNote}>Note: {task.note}</Text>
                ) : null}
                {task.issue ? (
                  <View style={styles.issueBox}>
                    <Text style={styles.issueTitle}>{task.issue.issueType}</Text>
                    <Text style={styles.issueText}>{task.issue.description}</Text>
                  </View>
                ) : null}
              </Card>
            );
          })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  title: { fontSize: 22, fontWeight: "900", color: colors.text },
  subtitle: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  statRow: { flexDirection: "row", gap: 10 },
  taskHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  taskName: { fontSize: 15, fontWeight: "800", color: colors.text },
  taskMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  taskFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  taskTime: { fontSize: 11, color: colors.muted },
  taskCategory: { fontSize: 11, color: colors.subtle },
  taskNote: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  issueBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 10,
    padding: 10,
    gap: 2,
  },
  issueTitle: { fontSize: 12, fontWeight: "800", color: colors.danger },
  issueText: { fontSize: 12, color: colors.danger },
});
