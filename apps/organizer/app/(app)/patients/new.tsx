import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";

import { Button, Card, Field, Screen } from "@/components/ui";
import { apiPost } from "@/lib/api";

export default function NewPatientScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [primaryContactName, setPrimaryContactName] = useState("");
  const [primaryContactPhone, setPrimaryContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: () => {
      if (!fullName.trim()) throw new Error("Add the care recipient's full name.");
      return apiPost("/api/patients", {
        fullName: fullName.trim(),
        preferredName: preferredName.trim() || undefined,
        dateOfBirth: dateOfBirth.trim() || undefined,
        primaryContactName: primaryContactName.trim() || undefined,
        primaryContactPhone: primaryContactPhone.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["patients"] });
      await queryClient.invalidateQueries({ queryKey: ["patient-options"] });
      router.back();
    },
    onError: (error) => {
      Alert.alert(
        "Could not save",
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
          placeholder="e.g. Maria Santos"
        />
        <Field
          label="Preferred name"
          value={preferredName}
          onChangeText={setPreferredName}
          placeholder="e.g. Lola Maria"
        />
        <Field
          label="Date of birth"
          value={dateOfBirth}
          onChangeText={setDateOfBirth}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
        />
        <Field
          label="Primary contact"
          value={primaryContactName}
          onChangeText={setPrimaryContactName}
          placeholder="Name of the main family contact"
        />
        <Field
          label="Contact phone"
          value={primaryContactPhone}
          onChangeText={setPrimaryContactPhone}
          placeholder="+63 900 000 0000"
          keyboardType="phone-pad"
        />
        <Field
          label="Address"
          value={address}
          onChangeText={setAddress}
          placeholder="Home address"
        />
        <Field
          label="Care notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Mobility, allergies, preferences, or anything the team should know"
          multiline
        />
      </Card>
      <Button
        title="Add care recipient"
        loading={create.isPending}
        onPress={() => create.mutate()}
      />
    </Screen>
  );
}
