import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { authClient } from "@/lib/api";

export default function Index() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <Redirect href={session ? "/(app)/checklist" : "/(auth)/sign-in"} />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
});
