import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Text, View } from "react-native";

import { Button, Card, Chips, Field, Screen } from "@/components/ui";
import { apiGet, apiPost } from "@/lib/api";
import type { PatientOption } from "@/lib/types";
import { colors } from "@/lib/theme";

export default function NewMedicationScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [patientId, setPatientId] = useState("none");
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [times, setTimes] = useState("08:00, 20:00");
  const [stock, setStock] = useState("");
  const [refillThreshold, setRefillThreshold] = useState("");
  const [instructions, setInstructions] = useState("");

  const patients = useQuery({
    queryKey: ["patient-options"],
    queryFn: () => apiGet<PatientOption[]>("/api/patient-options"),
  });

  const create = useMutation({
    mutationFn: () => {
      if (!name.trim()) throw new Error("Add the medication name.");
      const parsedTimes = times
        .split(",")
        .map((time) => time.trim())
        .filter(Boolean);
      if (parsedTimes.length === 0) {
        throw new Error("Add at least one dose time, for example 08:00.");
      }
      if (parsedTimes.some((time) => !/^\d{1,2}:\d{2}$/.test(time))) {
        throw new Error("Dose times must look like 08:00, 14:30, or 20:00.");
      }
      return apiPost("/api/medications", {
        patientId: patientId === "none" ? undefined : patientId,
        name: name.trim(),
        dosage: dosage.trim() || undefined,
        frequency: frequency.trim() || undefined,
        times: parsedTimes,
        stock: stock.trim() ? Number(stock) : undefined,
        refillThreshold: refillThreshold.trim() ? Number(refillThreshold) : undefined,
        instructions: instructions.trim() || undefined,
        active: true,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["medication-doses"] });
      await queryClient.invalidateQueries({ queryKey: ["medications"] });
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
        <Text style={styles.label}>For</Text>
        <Chips
          options={[
            { label: "No patient", value: "none" },
            ...(patients.data ?? []).map((patient) => ({
              label: patient.preferredName || patient.fullName,
              value: patient.id,
            })),
          ]}
          value={patientId}
          onChange={setPatientId}
        />
        <Field
          label="Medication name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Lisinopril"
        />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field
              label="Dosage"
              value={dosage}
              onChangeText={setDosage}
              placeholder="e.g. 10 mg"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Frequency"
              value={frequency}
              onChangeText={setFrequency}
              placeholder="e.g. Twice daily"
            />
          </View>
        </View>
        <Field
          label="Dose times"
          value={times}
          onChangeText={setTimes}
          placeholder="08:00, 20:00"
          autoCapitalize="none"
        />
        <Text style={styles.hint}>Separate times with commas, 24-hour format.</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field
              label="Stock on hand"
              value={stock}
              onChangeText={setStock}
              placeholder="e.g. 30"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Refill at"
              value={refillThreshold}
              onChangeText={setRefillThreshold}
              placeholder="e.g. 7"
              keyboardType="decimal-pad"
            />
          </View>
        </View>
        <Field
          label="Instructions"
          value={instructions}
          onChangeText={setInstructions}
          placeholder="e.g. Take with food"
          multiline
        />
      </Card>
      <Button
        title="Add medication"
        loading={create.isPending}
        onPress={() => create.mutate()}
      />
    </Screen>
  );
}

const styles = {
  label: { fontSize: 12, fontWeight: "700" as const, color: colors.muted },
  row: { flexDirection: "row" as const, gap: 10 },
  hint: { fontSize: 11, color: colors.subtle, marginTop: -4 },
};
