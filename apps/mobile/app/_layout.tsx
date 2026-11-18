import { ConvexAuthProvider } from "@convex-dev/auth/react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { convex } from "@/lib/convex";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ConvexAuthProvider client={convex} storage={AsyncStorage}>
        <Stack screenOptions={{ headerShown: false }} />
        <StatusBar style="auto" />
      </ConvexAuthProvider>
    </SafeAreaProvider>
  );
}
