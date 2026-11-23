import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Text } from "react-native";

import { Button, Card, Chips, Field, Screen } from "@/components/ui";
import { apiGet, apiPost } from "@/lib/api";
import type { Shift } from "@/lib/types";
import { colors } from "@/lib/theme";

export default function NewTeamMemberScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [shiftId, setShiftId] = useState("none");

  const shifts = useQuery({
    queryKey: ["shifts"],
    queryFn: () => apiGet<Shift[]>("/api/shifts"),
  });

  const create = useMutation({
    mutationFn: () => {
      if (!fullName.trim()) throw new Error("Add the person's full name.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        throw new Error("Add a valid email address for sign-in.");
      }
      if (password.length < 8) {
        throw new Error("The temporary password must be at least 8 characters.");
      }
      return apiPost("/api/caregivers", {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || undefined,
        shiftId: shiftId === "none" ? undefined : shiftId,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["caregivers"] });
      router.back();
      Alert.alert(
        "Care team member added",
        "Share the email and temporary password securely. They can sign in to the CareShift Caregiver app and change it later.",
      );
    },
    onError: (error) => {
      Alert.alert(
        "Could not add member",
        error instanceof Error ? error.message : "Try again.",
      );
    },
  });

  return (
    <Screen>
      <Card>
        <Field
          label="Full name"
          value={fullName}
          onChangeText={setFullName}
          placeholder="e.g. Ana Reyes"
        />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="ana@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Field
          label="Temporary password"
          value={password}
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          secureTextEntry
        />
        <Field
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          placeholder="+63 900 000 0000"
          keyboardType="phone-pad"
        />
        <Text style={styles.label}>Care schedule</Text>
        <Chips
          options={[
            { label: "No schedule", value: "none" },
            ...(shifts.data ?? []).map((shift) => ({
              label: shift.name,
              value: shift.id,
            })),
          ]}
          value={shiftId}
          onChange={setShiftId}
        />
        <Text style={styles.hint}>
          Care team members sign in to the CareShift Caregiver app with this
          email and temporary password.
        </Text>
      </Card>
      <Button
        title="Add care team member"
        loading={create.isPending}
        onPress={() => create.mutate()}
      />
    </Screen>
  );
}

const styles = {
  label: { fontSize: 12, fontWeight: "700" as const, color: colors.muted },
  hint: { fontSize: 11, color: colors.subtle, lineHeight: 16 },
};
