import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Avatar, Badge, Button, Card, Loading, Row, Screen, SectionTitle } from "@/components/ui";
import { API_URL, apiGet, authClient } from "@/lib/api";
import type { Me } from "@/lib/types";
import { colors } from "@/lib/theme";

export default function ProfileScreen() {
  const router = useRouter();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<Me>("/api/me"),
  });

  if (me.isLoading) return <Loading />;

  const signOut = () => {
    Alert.alert("Sign out?", "You will need your email and password to sign in again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await authClient.signOut();
          router.replace("/(auth)/sign-in");
        },
      },
    ]);
  };

  return (
    <Screen>
      <Card>
        <View style={styles.head}>
          <Avatar name={me.data?.profile?.fullName ?? "Organizer"} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>
              {me.data?.profile?.fullName ?? "Organizer"}
            </Text>
            <Text style={styles.email}>{me.data?.user.email ?? ""}</Text>
          </View>
          <Badge label="Organizer" tone="teal" />
        </View>
      </Card>

      <SectionTitle title="Account" />
      <Card>
        <Row label="Role" value={me.data?.profile?.role ?? "—"} />
        <Row label="Phone" value={me.data?.profile?.phone} />
        <Row label="Employee code" value={me.data?.profile?.employeeCode} />
        <Row label="Care schedule" value={me.data?.shift?.name} />
      </Card>

      <SectionTitle title="Connection" />
      <Card>
        <Row label="API" value={API_URL} />
        <Row label="App version" value={Constants.expoConfig?.version ?? "0.1.0"} />
        <Row label="Mode" value="Organizer" />
      </Card>

      <Button title="Sign out" variant="danger" onPress={signOut} />
      <Text style={styles.footer}>
        CareShift keeps the whole care team connected, informed, and confident
        that your loved one is being looked after.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontSize: 17, fontWeight: "900", color: colors.text },
  email: { fontSize: 12, color: colors.muted, marginTop: 2 },
  footer: {
    fontSize: 12,
    color: colors.subtle,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: 14,
  },
});
