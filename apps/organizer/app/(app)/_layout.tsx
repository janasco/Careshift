import { useQuery } from "@tanstack/react-query";
import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiGet, authClient } from "@/lib/api";
import type { Me } from "@/lib/types";
import { colors, radius } from "@/lib/theme";

export default function AppLayout() {
  const { data: session, isPending } = authClient.useSession();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<Me>("/api/me"),
    enabled: Boolean(session),
  });

  if (isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (me.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (me.isError) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Could not reach CareShift</Text>
          <Text style={styles.noticeText}>
            {me.error instanceof Error ? me.error.message : "Check the API URL and network."}
          </Text>
          <Pressable onPress={() => me.refetch()} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!me.data?.profile || me.data.profile.role !== "admin") {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Organizer access required</Text>
          <Text style={styles.noticeText}>
            This app is for the family organizer or supervisor. Caregivers
            should use the CareShift Caregiver app to see their checklist,
            visits, and medications.
          </Text>
          <Pressable
            onPress={async () => {
              await authClient.signOut();
            }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Sign out</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.primaryDark,
        headerTitleStyle: { fontWeight: "800" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="journal" options={{ title: "Care journal" }} />
      <Stack.Screen name="tasks" options={{ title: "Tasks" }} />
      <Stack.Screen name="reports" options={{ title: "Reports" }} />
      <Stack.Screen name="issues" options={{ title: "Issues" }} />
      <Stack.Screen name="profile" options={{ title: "Profile" }} />
      <Stack.Screen name="appointments/new" options={{ title: "New appointment" }} />
      <Stack.Screen name="medications/new" options={{ title: "Add medication" }} />
      <Stack.Screen name="patients/new" options={{ title: "Add care recipient" }} />
      <Stack.Screen name="patients/[id]" options={{ title: "Care recipient" }} />
      <Stack.Screen name="team/new" options={{ title: "Add care team member" }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  safe: { flex: 1, backgroundColor: colors.bg },
  notice: {
    margin: 20,
    marginTop: 60,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 22,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noticeTitle: { fontSize: 20, fontWeight: "900", color: colors.text },
  noticeText: { fontSize: 14, lineHeight: 20, color: colors.muted },
  primaryButton: {
    marginTop: 10,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonText: { color: "#ffffff", fontWeight: "800" },
});
