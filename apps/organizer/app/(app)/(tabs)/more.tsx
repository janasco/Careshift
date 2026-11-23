import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar, Badge, Card, Screen, SectionTitle } from "@/components/ui";
import { apiGet } from "@/lib/api";
import type { Issue, Me } from "@/lib/types";
import { colors, radius } from "@/lib/theme";

const MENU = [
  {
    title: "Care journal",
    description: "Observations, health notes, and daily updates",
    route: "/(app)/journal",
    glyph: "J",
  },
  {
    title: "Tasks",
    description: "Today's care tasks and completion status",
    route: "/(app)/tasks",
    glyph: "T",
  },
  {
    title: "Reports",
    description: "Daily completion, missed tasks, and care notes",
    route: "/(app)/reports",
    glyph: "R",
  },
  {
    title: "Issues",
    description: "Open concerns reported by the care team",
    route: "/(app)/issues",
    glyph: "!",
  },
] as const;

export default function MoreScreen() {
  const router = useRouter();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<Me>("/api/me"),
  });
  const issues = useQuery({
    queryKey: ["issues", "open"],
    queryFn: () => apiGet<Issue[]>("/api/issues?status=open"),
    refetchInterval: 60_000,
  });

  return (
    <Screen>
      <Card onPress={() => router.push("/(app)/profile")}>
        <View style={styles.profile}>
          <Avatar name={me.data?.profile?.fullName ?? "Organizer"} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>
              {me.data?.profile?.fullName ?? "Organizer"}
            </Text>
            <Text style={styles.email}>{me.data?.user.email ?? ""}</Text>
          </View>
          <Badge label="Organizer" tone="teal" />
        </View>
        <Text style={styles.profileHint}>Account, connection, and sign out</Text>
      </Card>

      <SectionTitle title="Care tools" hint="Everything the care team shares" />
      <View style={{ gap: 10 }}>
        {MENU.map((item) => (
          <Card key={item.title} onPress={() => router.push(item.route)}>
            <View style={styles.menuRow}>
              <View style={styles.menuGlyph}>
                <Text style={styles.menuGlyphText}>{item.glyph}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuText}>{item.description}</Text>
              </View>
              {item.title === "Issues" && (issues.data?.length ?? 0) > 0 ? (
                <Badge label={String(issues.data?.length)} tone="amber" />
              ) : (
                <Text style={styles.chevron}>›</Text>
              )}
            </View>
          </Card>
        ))}
      </View>

      <SectionTitle title="About" />
      <Card>
        <Text style={styles.aboutTitle}>CareShift Organizer</Text>
        <Text style={styles.aboutText}>
          Careshift brings your whole care team together — medications,
          appointments, tasks, and a shared journal in one place.
        </Text>
        <View style={styles.aboutMeta}>
          <Text style={styles.aboutSmall}>
            Version {Constants.expoConfig?.version ?? "0.1.0"}
          </Text>
          <Text style={styles.aboutSmall}>Family care coordination</Text>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontSize: 16, fontWeight: "800", color: colors.text },
  email: { fontSize: 12, color: colors.muted, marginTop: 2 },
  profileHint: { fontSize: 11, color: colors.subtle },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  menuGlyph: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  menuGlyphText: { color: colors.primaryDark, fontWeight: "900", fontSize: 15 },
  menuTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  menuText: { fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 16 },
  chevron: { fontSize: 24, color: colors.subtle, paddingHorizontal: 4 },
  aboutTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  aboutText: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  aboutMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  aboutSmall: { fontSize: 11, color: colors.subtle },
});
