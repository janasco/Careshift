import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
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

import { apiGet, authClient } from "@/lib/api";
import { registerPushToken } from "@/lib/push";
import { ensureRemindersPermission } from "@/lib/reminders";

export default function ProfileScreen() {
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet("/api/me"),
  });
  const router = useRouter();
  const [reminderBusy, setReminderBusy] = useState(false);

  const enableReminders = async () => {
    setReminderBusy(true);
    try {
      const granted = await ensureRemindersPermission();
      if (granted) {
        await registerPushToken();
        Alert.alert(
          "Reminders enabled",
          "Task and medication reminders will be scheduled from today's checklist and medication list.",
        );
      } else {
        Alert.alert(
          "Permission needed",
          "Allow notifications in Android settings to receive reminders.",
        );
      }
    } finally {
      setReminderBusy(false);
    }
  };

  if (me.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Caregiver</Text>
          <Text style={styles.name}>
            {me.data?.profile?.fullName ?? me.data?.user?.name ?? "Caregiver"}
          </Text>
          <Text style={styles.email}>{me.data?.user?.email}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Role</Text>
            <Text style={styles.value}>{me.data?.profile?.role ?? "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Shift</Text>
            <Text style={styles.value}>
              {me.data?.profile?.shiftId ? "Assigned" : "Not assigned"}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={enableReminders}
          disabled={reminderBusy}
          style={({ pressed }) => [
            styles.reminderButton,
            pressed && { opacity: 0.8 },
          ]}
        >
          {reminderBusy ? (
            <ActivityIndicator color="#0f766e" />
          ) : (
            <Text style={styles.reminderText}>Enable device reminders</Text>
          )}
        </Pressable>

        <Pressable
          onPress={async () => {
            await authClient.signOut();
            router.replace("/(auth)/sign-in");
          }}
          style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  eyebrow: { color: "#0f766e", fontWeight: "800", fontSize: 12, textTransform: "uppercase" },
  name: { fontSize: 24, fontWeight: "800", color: "#0f172a" },
  email: { color: "#64748b", marginBottom: 10 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  label: { color: "#64748b", fontSize: 13 },
  value: { color: "#0f172a", fontWeight: "600", fontSize: 13, textTransform: "capitalize" },
  reminderButton: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#99f6e4",
    paddingVertical: 14,
    alignItems: "center",
  },
  reminderText: { color: "#0f766e", fontWeight: "700" },
  signOut: {
    backgroundColor: "#0f172a",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  signOutText: { color: "#ffffff", fontWeight: "800" },
});
