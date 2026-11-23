import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  Field,
  Loading,
  Screen,
  Sheet,
} from "@/components/ui";
import { apiGet, apiPatch } from "@/lib/api";
import { formatDateTime, relativeTime } from "@/lib/format";
import type { Issue } from "@/lib/types";
import { colors, radius } from "@/lib/theme";

type Status = "open" | "resolved";

export default function IssuesScreen() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("open");
  const [selected, setSelected] = useState<Issue | null>(null);
  const [note, setNote] = useState("");

  const issues = useQuery({
    queryKey: ["issues", status],
    queryFn: () => apiGet<Issue[]>(`/api/issues?status=${status}`),
    refetchInterval: 30_000,
  });

  const resolve = useMutation({
    mutationFn: (issue: Issue) =>
      apiPatch(`/api/issues/${issue.id}/resolve`, { note: note.trim() || undefined }),
    onSuccess: async () => {
      setSelected(null);
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["issues"] });
    },
    onError: (error) => {
      Alert.alert(
        "Could not resolve",
        error instanceof Error ? error.message : "Try again.",
      );
    },
  });

  return (
    <>
      <Screen refreshing={issues.isRefetching} onRefresh={() => issues.refetch()}>
        <View style={styles.header}>
          <Text style={styles.title}>Issues</Text>
          <Text style={styles.subtitle}>
            Concerns reported by the care team. Resolve them with a short
            follow-up note.
          </Text>
        </View>

        <View style={styles.segment}>
          {(["open", "resolved"] as Status[]).map((value) => {
            const active = status === value;
            return (
              <Pressable
                key={value}
                onPress={() => setStatus(value)}
                style={[styles.segmentItem, active && styles.segmentSelected]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    active && { color: colors.primaryDark, fontWeight: "800" },
                  ]}
                >
                  {value === "open" ? "Open" : "Resolved"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {issues.isLoading ? <Loading /> : null}
        {issues.isError ? (
          <ErrorNotice
            message={
              issues.error instanceof Error ? issues.error.message : "Could not load issues."
            }
            onRetry={() => issues.refetch()}
          />
        ) : null}

        {issues.data && issues.data.length === 0 ? (
          <EmptyState
            title={status === "open" ? "No open issues" : "Nothing resolved yet"}
            message={
              status === "open"
                ? "The care team has not reported any concerns."
                : "Resolved issues will be listed here."
            }
          />
        ) : null}

        {(issues.data ?? []).map((issue) => (
          <Card key={issue.id}>
            <View style={styles.issueHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.issueType}>{issue.issueType}</Text>
                <Text style={styles.issueMeta}>
                  {issue.caregiverName ?? "Care team"} ·{" "}
                  {relativeTime(issue.createdAt)}
                </Text>
              </View>
              <Badge
                label={issue.status}
                tone={issue.status === "open" ? "amber" : "green"}
              />
            </View>
            <Text style={styles.issueText}>{issue.description}</Text>
            {issue.taskName ? (
              <Text style={styles.issueTask}>
                {issue.taskName}
                {issue.taskDate ? ` · ${issue.taskDate}` : ""}
              </Text>
            ) : null}
            {issue.resolvedAt ? (
              <Text style={styles.resolved}>
                Resolved {formatDateTime(issue.resolvedAt)}
              </Text>
            ) : (
              <Button
                title="Resolve issue"
                variant="secondary"
                onPress={() => {
                  setSelected(issue);
                  setNote("");
                }}
              />
            )}
          </Card>
        ))}
      </Screen>

      <Sheet
        visible={Boolean(selected)}
        title="Resolve issue"
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <>
            <Card>
              <Text style={styles.sheetType}>{selected.issueType}</Text>
              <Text style={styles.sheetText}>{selected.description}</Text>
            </Card>
            <Field
              label="Resolution note (optional)"
              value={note}
              onChangeText={setNote}
              placeholder="What was done, who followed up, and what happens next?"
              multiline
            />
            <Button
              title="Mark resolved"
              loading={resolve.isPending}
              onPress={() => resolve.mutate(selected)}
            />
          </>
        ) : null}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  title: { fontSize: 22, fontWeight: "900", color: colors.text },
  subtitle: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  segment: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderRadius: radius.pill,
    padding: 3,
  },
  segmentItem: {
    flex: 1,
    borderRadius: radius.pill,
    paddingVertical: 8,
    alignItems: "center",
  },
  segmentSelected: { backgroundColor: colors.card },
  segmentText: { fontSize: 12, fontWeight: "600", color: colors.muted },
  issueHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  issueType: { fontSize: 15, fontWeight: "800", color: colors.text },
  issueMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  issueText: { fontSize: 13, color: colors.text, lineHeight: 19 },
  issueTask: { fontSize: 11, color: colors.subtle },
  resolved: { fontSize: 11, color: colors.success },
  sheetType: { fontSize: 15, fontWeight: "800", color: colors.text },
  sheetText: { fontSize: 13, color: colors.muted, lineHeight: 19 },
});
