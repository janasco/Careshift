import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  Loading,
  Screen,
  SectionTitle,
} from "@/components/ui";
import { apiGet } from "@/lib/api";
import { ageFromDob, relativeTime } from "@/lib/format";
import type { Caregiver, PatientSummary } from "@/lib/types";
import { colors, radius } from "@/lib/theme";

type Segment = "patients" | "team";

export default function PeopleScreen() {
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>("patients");

  const patients = useQuery({
    queryKey: ["patients", "summaries"],
    queryFn: () => apiGet<PatientSummary[]>("/api/patients/summaries"),
  });
  const team = useQuery({
    queryKey: ["caregivers"],
    queryFn: () => apiGet<Caregiver[]>("/api/caregivers"),
  });

  const active = segment === "patients" ? patients : team;

  return (
    <Screen
      refreshing={active.isRefetching}
      onRefresh={() => active.refetch()}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>People</Text>
          <Text style={styles.subtitle}>
            The person you care for and everyone who helps.
          </Text>
        </View>
      </View>

      <View style={styles.segment}>
        {(
          [
            ["patients", "Care recipient"],
            ["team", "Care team"],
          ] as Array<[Segment, string]>
        ).map(([value, label]) => {
          const selected = segment === value;
          return (
            <Pressable
              key={value}
              onPress={() => setSegment(value)}
              style={[styles.segmentItem, selected && styles.segmentSelected]}
            >
              <Text
                style={[
                  styles.segmentText,
                  selected && { color: colors.primaryDark, fontWeight: "800" },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Button
        title={
          segment === "patients"
            ? "+ Add care recipient"
            : "+ Add care team member"
        }
        onPress={() =>
          router.push(
            segment === "patients" ? "/(app)/patients/new" : "/(app)/team/new",
          )
        }
      />

      {active.isLoading ? <Loading /> : null}

      {active.isError ? (
        <ErrorNotice
          message={
            active.error instanceof Error
              ? active.error.message
              : "Could not load people."
          }
          onRetry={() => active.refetch()}
        />
      ) : null}

      {segment === "patients" && patients.data ? (
        <>
          <SectionTitle
            title="Care recipient"
            hint={`${patients.data.length} in the workspace`}
          />
          {patients.data.length === 0 ? (
            <EmptyState
              title="No care recipient yet"
              message="Add your loved one to start building medications, tasks, and the shared calendar."
            />
          ) : (
            patients.data.map((patient) => {
              const age = ageFromDob(patient.dateOfBirth);
              return (
                <Card
                  key={patient.id}
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/patients/[id]",
                      params: { id: patient.id },
                    })
                  }
                >
                  <View style={styles.personRow}>
                    <Avatar name={patient.fullName} tone="violet" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.personName}>{patient.fullName}</Text>
                      <Text style={styles.personMeta}>
                        {[
                          patient.preferredName,
                          age != null ? `${age} years old` : null,
                          patient.status === "active" ? null : patient.status,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Care recipient"}
                      </Text>
                    </View>
                    <Badge
                      label={patient.status}
                      tone={patient.status === "active" ? "green" : "slate"}
                    />
                  </View>
                  {patient.primaryContactName || patient.primaryContactPhone ? (
                    <Text style={styles.personLine}>
                      Contact:{" "}
                      {[patient.primaryContactName, patient.primaryContactPhone]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  ) : null}
                  <View style={styles.personStats}>
                    <Text style={styles.personStat}>
                      {patient.careEventCount} journal entries
                    </Text>
                    <Text style={styles.personStat}>
                      {patient.vitalsCount} vitals
                    </Text>
                    {patient.latestEvent ? (
                      <Text style={styles.personStat}>
                        Updated {relativeTime(patient.latestEvent.createdAt)}
                      </Text>
                    ) : null}
                  </View>
                </Card>
              );
            })
          )}
        </>
      ) : null}

      {segment === "team" && team.data ? (
        <>
          <SectionTitle
            title="Care team"
            hint={`${team.data.filter((member) => member.status === "active").length} active`}
          />
          {team.data.length === 0 ? (
            <EmptyState
              title="No care team yet"
              message="Add family members or hired caregivers and assign them a schedule."
            />
          ) : (
            team.data.map((member) => (
              <Card key={member.id}>
                <View style={styles.personRow}>
                  <Avatar name={member.fullName} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.personName}>{member.fullName}</Text>
                    <Text style={styles.personMeta}>
                      {member.email ?? "No email"}
                    </Text>
                  </View>
                  <Badge
                    label={member.status}
                    tone={member.status === "active" ? "green" : "slate"}
                  />
                </View>
                <View style={styles.personStats}>
                  <Text style={styles.personStat}>
                    {member.shiftName ?? "No schedule"}
                  </Text>
                  {member.employeeCode ? (
                    <Text style={styles.personStat}>{member.employeeCode}</Text>
                  ) : null}
                  {member.lastLoginAt ? (
                    <Text style={styles.personStat}>
                      Last seen {relativeTime(member.lastLoginAt)}
                    </Text>
                  ) : (
                    <Text style={styles.personStat}>Has not signed in yet</Text>
                  )}
                </View>
              </Card>
            ))
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", gap: 10 },
  title: { fontSize: 22, fontWeight: "900", color: colors.text },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 3 },
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
  personRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  personName: { fontSize: 15, fontWeight: "800", color: colors.text },
  personMeta: { fontSize: 12, color: colors.muted, marginTop: 1 },
  personLine: { fontSize: 12, color: colors.muted },
  personStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  personStat: { fontSize: 11, color: colors.subtle },
});
