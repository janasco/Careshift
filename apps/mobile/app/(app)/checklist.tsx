import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import { syncTaskReminders } from "@/lib/reminders";

type Task = {
  _id: string;
  taskName: string;
  category: string;
  priority: string;
  patientName?: string;
  scheduledTime: string;
  dueMs: number;
  status: string;
  note?: string | null;
  issue?: { issueType: string; description: string; status: string } | null;
};

export default function ChecklistScreen() {
  const today = todayStr();
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet("/api/me"),
  });
  const shifts = useQuery({
    queryKey: ["shifts"],
    queryFn: () => apiGet("/api/shifts"),
  });
  const tasks = useQuery({
    queryKey: ["checklist", today],
    queryFn: () => apiGet<Task[]>(`/api/tasks/checklist/my-tasks?date=${today}`),
  });
  const completeTask = useMutation({
    mutationFn: (taskId: string) =>
      apiPost("/api/tasks/checklist/complete", { taskId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["checklist", today] });
    },
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const materialized = useRef(false);

  useEffect(() => {
    if (materialized.current) return;
    materialized.current = true;
    void apiPost("/api/tasks/materialize", { date: today })
      .then(() =>
        queryClient.invalidateQueries({ queryKey: ["checklist", today] }),
      )
      .catch(() => {
        /* the list will refresh on the next load */
      });
  }, [today, queryClient]);

  const shift = shifts.data?.find(
    (row: any) => row._id === me.data?.profile?.shiftId,
  );
  const taskList = tasks.data ?? [];

  useEffect(() => {
    if (tasks.data) void syncTaskReminders(tasks.data);
  }, [tasks.data]);

  const done = taskList.filter((task) => task.status === "completed").length;
  const total = taskList.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const complete = async (task: Task) => {
    setBusyId(task._id);
    try {
      await completeTask.mutateAsync(task._id);
    } catch (error) {
      Alert.alert(
        "Could not complete task",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>{shift?.name ?? "My shift"}</Text>
          <Text style={styles.title}>{me.data?.profile?.fullName ?? me.data?.user?.name ?? "Caregiver"}</Text>
          <Text style={styles.subtitle}>{today}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {done}/{total} tasks complete · {pct}%
          </Text>
        </View>

        <Pressable
          onPress={() => router.push("/handoff")}
          style={({ pressed }) => [
            styles.handoffButton,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={styles.handoffText}>View shift handoff summary</Text>
        </Pressable>

        {tasks.isLoading && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#0f766e" />
          </View>
        )}

        {!tasks.isLoading && taskList.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No tasks assigned today</Text>
            <Text style={styles.emptyText}>
              Your supervisor will add tasks to your shift checklist.
            </Text>
          </View>
        )}

        {taskList.map((task) => {
          const isDone =
            task.status === "completed" || task.status === "completed_with_issue";
          return (
            <View key={task._id} style={[styles.card, isDone && styles.cardDone]}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.taskName, isDone && styles.taskNameDone]}>
                    {task.taskName}
                  </Text>
                  <Text style={styles.taskMeta}>
                    {task.patientName ? `${task.patientName} · ` : ""}
                    {formatTimeLabel(task.scheduledTime)} · {task.category} ·{" "}
                    {task.priority}
                  </Text>
                </View>
                <View
                  style={[
                    styles.badge,
                    isDone
                      ? styles.badgeDone
                      : task.issue
                        ? styles.badgeIssue
                        : styles.badgePending,
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {task.status === "completed_with_issue"
                      ? "Issue"
                      : isDone
                        ? "Done"
                        : "Pending"}
                  </Text>
                </View>
              </View>

              {task.note ? <Text style={styles.note}>{task.note}</Text> : null}
              {task.issue ? (
                <Text style={styles.issueText}>
                  {task.issue.issueType}: {task.issue.description}
                </Text>
              ) : null}

              {!isDone && (
                <Pressable
                  onPress={() => complete(task)}
                  disabled={busyId === task._id}
                  style={({ pressed }) => [
                    styles.completeButton,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  {busyId === task._id ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.completeText}>Mark complete</Text>
                  )}
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  hero: {
    backgroundColor: "#0f766e",
    borderRadius: 18,
    padding: 18,
    gap: 4,
  },
  eyebrow: { color: "#99f6e4", fontWeight: "700", fontSize: 12, textTransform: "uppercase" },
  title: { color: "#ffffff", fontWeight: "800", fontSize: 22 },
  subtitle: { color: "#ccfbf1", fontSize: 13 },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginTop: 12,
    overflow: "hidden",
  },
  progressFill: { height: 8, borderRadius: 999, backgroundColor: "#5eead4" },
  progressText: { color: "#ccfbf1", fontSize: 12, marginTop: 6 },
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
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardDone: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  taskName: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  taskNameDone: { color: "#64748b", textDecorationLine: "line-through" },
  taskMeta: { fontSize: 12, color: "#64748b", marginTop: 2, textTransform: "capitalize" },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeDone: { backgroundColor: "#dcfce7" },
  badgePending: { backgroundColor: "#fef3c7" },
  badgeIssue: { backgroundColor: "#fee2e2" },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#334155" },
  note: { fontSize: 13, color: "#475569" },
  issueText: { fontSize: 13, color: "#b91c1c" },
  handoffButton: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#99f6e4",
    paddingVertical: 11,
    alignItems: "center",
    marginBottom: 2,
  },
  handoffText: { color: "#0f766e", fontWeight: "700", fontSize: 13 },
  completeButton: {
    backgroundColor: "#0f766e",
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: 2,
  },
  completeText: { color: "#ffffff", fontWeight: "700" },
});
