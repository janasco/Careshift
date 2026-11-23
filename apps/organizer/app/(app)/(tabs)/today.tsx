import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { todayStr } from "@careshift/shared";

import {
  Avatar,
  Badge,
  Button,
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
import {
  endOfDay,
  formatClock,
  formatShortDate,
  relativeTime,
  startOfDay,
  statusLabel,
} from "@/lib/format";
import type {
  AdminSummary,
  CalendarEvent,
  Issue,
  Me,
  MedicationDoseRow,
} from "@/lib/types";
import { colors, radius } from "@/lib/theme";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function doseMs(time: string) {
  return new Date(`${todayStr()}T${time}:00`).getTime();
}

export default function TodayScreen() {
  const router = useRouter();
  const date = todayStr();

  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<Me>("/api/me"),
  });
  const summary = useQuery({
    queryKey: ["summary", date],
    queryFn: () => apiGet<AdminSummary>(`/api/admin/summary?date=${date}`),
    refetchInterval: 20_000,
  });
  const meds = useQuery({
    queryKey: ["medication-doses", date],
    queryFn: () => apiGet<MedicationDoseRow[]>(`/api/medications/doses?date=${date}`),
    refetchInterval: 30_000,
  });
  const calendar = useQuery({
    queryKey: ["calendar", "today", date],
    queryFn: () =>
      apiGet<CalendarEvent[]>(
        `/api/calendar?fromMs=${startOfDay().getTime()}&toMs=${endOfDay().getTime()}`,
      ),
    refetchInterval: 60_000,
  });
  const issues = useQuery({
    queryKey: ["issues", "open"],
    queryFn: () => apiGet<Issue[]>("/api/issues?status=open"),
    refetchInterval: 30_000,
  });

  const refreshing =
    summary.isRefetching || meds.isRefetching || calendar.isRefetching || issues.isRefetching;

  const refresh = () => {
    void summary.refetch();
    void meds.refetch();
    void calendar.refetch();
    void issues.refetch();
    void me.refetch();
  };

  if (summary.isLoading || meds.isLoading) {
    return <Loading label="Loading today's care…" />;
  }

  if (summary.isError) {
    return (
      <Screen>
        <ErrorNotice
          message={
            summary.error instanceof Error ? summary.error.message : "Could not load today."
          }
          onRetry={() => summary.refetch()}
        />
      </Screen>
    );
  }

  if (!summary.data) return <Loading label="Loading today's care…" />;

  const data = summary.data;
  const doseRows = meds.data ?? [];
  const allDoses = doseRows.flatMap((medication) =>
    medication.doses.map((dose) => ({ medication, dose })),
  );
  const takenDoses = allDoses.filter((row) => row.dose.log?.status === "taken").length;
  const overdueDoses = allDoses.filter(
    (row) => !row.dose.log && doseMs(row.dose.time) < Date.now(),
  ).length;
  const upcomingDoses = allDoses
    .filter((row) => !row.dose.log && doseMs(row.dose.time) >= Date.now())
    .sort((a, b) => doseMs(a.dose.time) - doseMs(b.dose.time));
  const nextDose = upcomingDoses[0];
  const todayEvents = (calendar.data ?? []).slice().sort((a, b) => a.startMs - b.startMs);
  const nextEvent = todayEvents.find((event) => event.startMs >= Date.now());
  const openIssues = issues.data ?? [];
  const firstName = me.data?.profile?.fullName?.split(" ")[0] ?? "there";

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>{formatShortDate(date)}</Text>
        <Text style={styles.heroTitle}>
          {greeting()}, {firstName}
        </Text>
        <Text style={styles.heroText}>
          {data.totalTasks > 0
            ? `${data.completed + data.withIssue} of ${data.totalTasks} care tasks are done. ${
                data.overdue > 0 ? `${data.overdue} need attention.` : "The day is on track."
              }`
            : "No tasks are scheduled yet. Add your care recipient and start building the routine."}
        </Text>
      </View>

      <View style={styles.statRow}>
        <StatCard
          label="Task completion"
          value={`${data.completionRate}%`}
          hint={`${data.completed} done · ${data.pending} pending`}
        />
        <StatCard
          label="Medications"
          value={`${takenDoses}/${allDoses.length}`}
          hint={overdueDoses > 0 ? `${overdueDoses} overdue` : "given today"}
          tone={overdueDoses > 0 ? "red" : "teal"}
        />
      </View>
      <View style={styles.statRow}>
        <StatCard
          label="Appointments"
          value={todayEvents.length}
          hint={nextEvent ? `Next ${formatClock(nextEvent.startMs)}` : "Nothing today"}
          tone="violet"
        />
        <StatCard
          label="Open issues"
          value={openIssues.length}
          hint={openIssues.length > 0 ? "Needs follow-up" : "All clear"}
          tone={openIssues.length > 0 ? "amber" : "teal"}
        />
      </View>

      <View style={styles.actionRow}>
        <Button
          title="Add appointment"
          onPress={() => router.push("/(app)/appointments/new")}
          style={{ flex: 1 }}
        />
        <Button
          title="Journal note"
          variant="secondary"
          onPress={() => router.push("/(app)/journal")}
          style={{ flex: 1 }}
        />
      </View>

      <SectionTitle title="Next up" hint="Today's care at a glance" />
      <Card>
        <View style={styles.nextRow}>
          <View style={styles.nextIcon}>
            <Text style={styles.nextIconText}>A</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.nextLabel}>Appointment</Text>
            <Text style={styles.nextTitle}>
              {nextEvent ? nextEvent.title : "No more appointments today"}
            </Text>
            <Text style={styles.nextMeta}>
              {nextEvent
                ? `${formatClock(nextEvent.startMs)}${nextEvent.location ? ` · ${nextEvent.location}` : ""}`
                : "Add one from the calendar"}
            </Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.nextRow}>
          <View style={[styles.nextIcon, { backgroundColor: colors.violetSoft }]}>
            <Text style={[styles.nextIconText, { color: colors.violet }]}>M</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.nextLabel}>Medication</Text>
            <Text style={styles.nextTitle}>
              {nextDose ? nextDose.medication.name : "All doses logged"}
            </Text>
            <Text style={styles.nextMeta}>
              {nextDose
                ? `${formatClock(doseMs(nextDose.dose.time))} · ${
                    nextDose.medication.dosage ?? "No dosage"
                  } · ${nextDose.medication.patientName}`
                : "You are caught up for now"}
            </Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.nextRow}>
          <View style={[styles.nextIcon, { backgroundColor: colors.warningSoft }]}>
            <Text style={[styles.nextIconText, { color: colors.warning }]}>!</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.nextLabel}>Needs attention</Text>
            <Text style={styles.nextTitle}>
              {data.overdue > 0
                ? `${data.overdue} overdue task${data.overdue === 1 ? "" : "s"}`
                : openIssues.length > 0
                  ? `${openIssues.length} open issue${openIssues.length === 1 ? "" : "s"}`
                  : "Nothing overdue"}
            </Text>
            <Text style={styles.nextMeta}>
              {data.overdue > 0
                ? "Review the task list with the care team"
                : openIssues.length > 0
                  ? "Resolve or add a follow-up note"
                  : "The care plan is up to date"}
            </Text>
          </View>
        </View>
      </Card>

      <SectionTitle
        title="Care team today"
        hint="Progress by caregiver and family member"
        action={
          <Text
            style={styles.link}
            onPress={() => router.push("/(app)/(tabs)/people")}
          >
            View all
          </Text>
        }
      />
      {data.caregiverStatus.length === 0 ? (
        <EmptyState
          title="No care team yet"
          message="Add family members or caregivers from the People tab to start assigning tasks."
        />
      ) : (
        <Card>
          {data.caregiverStatus.map((member, index) => {
            const done = member.completed + member.withIssue;
            const progress = member.total > 0 ? (done / member.total) * 100 : 0;
            const tone =
              member.liveStatus === "overdue"
                ? "red"
                : member.liveStatus === "completed"
                  ? "green"
                  : member.liveStatus === "working"
                    ? "teal"
                    : "slate";
            return (
              <View
                key={member.caregiverId}
                style={[styles.member, index > 0 && styles.memberBorder]}
              >
                <View style={styles.memberHead}>
                  <Avatar name={member.name} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <Text style={styles.memberShift}>
                      {member.shiftName} · {member.completed}/{member.total} done
                    </Text>
                  </View>
                  <Badge label={statusLabel(member.liveStatus)} tone={tone} />
                </View>
                <ProgressBar value={progress} />
                <Text style={styles.memberMeta}>
                  {member.overdue > 0
                    ? `${member.overdue} overdue`
                    : member.pending > 0
                      ? `${member.pending} still pending`
                      : "All tasks complete"}
                  {member.withIssue > 0 ? ` · ${member.withIssue} with issue` : ""}
                </Text>
              </View>
            );
          })}
        </Card>
      )}

      {openIssues.length > 0 ? (
        <>
          <SectionTitle
            title="Open issues"
            action={
              <Text style={styles.link} onPress={() => router.push("/(app)/issues")}>
                Resolve
              </Text>
            }
          />
          <Card>
            {openIssues.slice(0, 3).map((issue, index) => (
              <View
                key={issue.id}
                style={[styles.issueRow, index > 0 && styles.memberBorder]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.issueType}>{issue.issueType}</Text>
                  <Text style={styles.issueText} numberOfLines={2}>
                    {issue.description}
                  </Text>
                  <Text style={styles.issueMeta}>
                    {issue.caregiverName ?? "Care team"} · {relativeTime(issue.createdAt)}
                  </Text>
                </View>
                <Badge label="Open" tone="amber" />
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.lg,
    padding: 20,
    gap: 5,
  },
  heroEyebrow: {
    color: "#99f6e4",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroTitle: { color: "#ffffff", fontSize: 27, fontWeight: "900", lineHeight: 33 },
  heroText: { color: "#ccfbf1", fontSize: 13, lineHeight: 19, marginTop: 3 },
  statRow: { flexDirection: "row", gap: 10 },
  actionRow: { flexDirection: "row", gap: 10 },
  nextRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  nextIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  nextIconText: { color: colors.primaryDark, fontWeight: "900", fontSize: 14 },
  nextLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  nextTitle: { color: colors.text, fontSize: 14, fontWeight: "700", marginTop: 1 },
  nextMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border },
  link: { color: colors.primary, fontWeight: "800", fontSize: 12 },
  member: { gap: 8 },
  memberBorder: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  memberHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  memberName: { color: colors.text, fontWeight: "800", fontSize: 14 },
  memberShift: { color: colors.muted, fontSize: 12, marginTop: 1 },
  memberMeta: { color: colors.muted, fontSize: 11 },
  issueRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  issueType: { color: colors.text, fontWeight: "800", fontSize: 13 },
  issueText: { color: colors.muted, fontSize: 12, marginTop: 2, lineHeight: 17 },
  issueMeta: { color: colors.subtle, fontSize: 11, marginTop: 3 },
});
