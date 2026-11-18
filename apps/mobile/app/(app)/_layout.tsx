import { useQuery } from "@tanstack/react-query";
import { Redirect, Tabs } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiGet, authClient } from "@/lib/api";

export default function AppLayout() {
  const { data: session, isPending } = authClient.useSession();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet("/api/me"),
    enabled: Boolean(session),
  });

  if (isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (me.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  if (!me.data?.profile || me.data.profile.role !== "caregiver") {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Use the website for admin work</Text>
          <Text style={styles.noticeText}>
            The mobile app is for caregiver checklists and visit clock-in/out.
            Sign in on the website to manage patients, staff, and reports.
          </Text>
          <Pressable
            onPress={async () => {
              await authClient.signOut();
            }}
            style={styles.signOut}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: "#0f766e",
        tabBarInactiveTintColor: "#64748b",
        tabBarStyle: { backgroundColor: "#ffffff" },
      }}
    >
      <Tabs.Screen name="checklist" options={{ title: "Checklist" }} />
      <Tabs.Screen name="visit" options={{ title: "Visit" }} />
      <Tabs.Screen name="medications" options={{ title: "Meds" }} />
      <Tabs.Screen name="care" options={{ title: "Care" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  notice: {
    margin: 20,
    marginTop: 60,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 22,
    gap: 10,
  },
  noticeTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  noticeText: { fontSize: 14, lineHeight: 20, color: "#475569" },
  signOut: {
    marginTop: 10,
    backgroundColor: "#0f766e",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  signOutText: { color: "#ffffff", fontWeight: "700" },
});
