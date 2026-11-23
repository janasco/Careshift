import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { authClient } from "@/lib/api";
import { colors, radius } from "@/lib/theme";

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    try {
      const result = await authClient.signIn.email({
        email: email.trim().toLowerCase(),
        password,
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Sign-in failed");
      }
      router.replace("/(app)/(tabs)/today");
    } catch (error) {
      Alert.alert(
        "Sign-in failed",
        error instanceof Error
          ? error.message
          : "Check your email and password, then try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandRow}>
            <View style={styles.mark}>
              <Text style={styles.markText}>C</Text>
            </View>
            <View>
              <Text style={styles.brand}>CareShift</Text>
              <Text style={styles.brandSub}>ORGANIZER</Text>
            </View>
          </View>

          <Text style={styles.title}>Your care team, in one place.</Text>
          <Text style={styles.subtitle}>
            Coordinate medications, appointments, tasks, and notes for the
            person you care for — and keep every family member in the loop.
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={colors.subtle}
              style={styles.input}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Your password"
              placeholderTextColor={colors.subtle}
              style={styles.input}
              onSubmitEditing={submit}
            />

            <Pressable
              onPress={submit}
              disabled={busy}
              style={({ pressed }) => [
                styles.button,
                (pressed || busy) && styles.buttonPressed,
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Sign in as organizer</Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.hint}>
            Caregivers should use the CareShift Caregiver app. Organizer
            accounts are created by the workspace administrator.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f0fdfa" },
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 22, gap: 12 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  markText: { color: "#ffffff", fontWeight: "900", fontSize: 23 },
  brand: { color: colors.primaryDark, fontWeight: "900", fontSize: 19 },
  brandSub: {
    color: colors.muted,
    fontWeight: "800",
    fontSize: 10,
    letterSpacing: 2,
  },
  title: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 30,
    lineHeight: 35,
    marginTop: 10,
  },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: radius.lg,
    padding: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 6,
  },
  label: { color: colors.text, fontWeight: "700", fontSize: 12, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 14,
  },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: "#ffffff", fontWeight: "800", fontSize: 15 },
  hint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    paddingHorizontal: 12,
    marginTop: 4,
  },
});
