import type { VetVisitValue } from "@pawcareright/types";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";

import { validateVetVisitForm, type VetVisitFormErrors } from "../health-logs/health-log-forms";
import { strings } from "../strings";
import { HealthLogPhotoPicker } from "./health-log-photo-picker";
import { PrimaryButton } from "./primary-button";
import { TextField } from "./text-field";

export interface AddVetVisitFormProps {
  petId: string;
  submitting: boolean;
  onSubmit: (value: VetVisitValue, photoKeys: string[]) => void;
}

const FIELD_ERROR_STRINGS = {
  reason: { empty: strings.vetVisit.errorReasonEmpty, tooLong: strings.vetVisit.errorTooLong },
  clinicName: { empty: strings.vetVisit.errorTooLong, tooLong: strings.vetVisit.errorTooLong },
  notes: { empty: strings.vetVisit.errorTooLong, tooLong: strings.vetVisit.errorTooLong },
} as const;

/**
 * The "vet visit" quick-action form body (T066 plan) — record-only fields,
 * no cost/med/dose field (decision 5 / CLAUDE §7). Owns keyboard-avoidance
 * (§6); the screen already provides the safe-area. Validates through the
 * shared `vetVisitValueSchema` (`validateVetVisitForm`) before ever calling
 * `onSubmit`.
 */
export function AddVetVisitForm({ petId, submitting, onSubmit }: AddVetVisitFormProps) {
  const [reason, setReason] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [notes, setNotes] = useState("");
  const [photoKeys, setPhotoKeys] = useState<string[]>([]);
  const [errors, setErrors] = useState<VetVisitFormErrors>({});

  function handleSave() {
    const result = validateVetVisitForm({ reason, clinicName, notes });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    onSubmit(result.value, photoKeys);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
      <ScrollView className="flex-1">
        <View className="gap-4 px-6 pb-8 pt-4">
          <TextField
            testID="add-vet-visit-reason"
            label={strings.vetVisit.reasonPlaceholder}
            value={reason}
            onChangeText={setReason}
          />
          {errors.reason !== undefined ? (
            <Text testID="add-vet-visit-error-reason" accessibilityRole="alert" className="text-sm text-red-700">
              {FIELD_ERROR_STRINGS.reason[errors.reason]}
            </Text>
          ) : null}

          <TextField
            testID="add-vet-visit-clinic"
            label={strings.vetVisit.clinicPlaceholder}
            value={clinicName}
            onChangeText={setClinicName}
          />
          {errors.clinicName !== undefined ? (
            <Text testID="add-vet-visit-error-clinic" accessibilityRole="alert" className="text-sm text-red-700">
              {FIELD_ERROR_STRINGS.clinicName[errors.clinicName]}
            </Text>
          ) : null}

          <TextInput
            testID="add-vet-visit-notes"
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder={strings.vetVisit.notesPlaceholder}
            placeholderTextColor="#2f8f74"
            className="min-h-[100px] rounded-lg border border-brand-100 px-4 py-3 text-base text-brand-900"
          />
          {errors.notes !== undefined ? (
            <Text testID="add-vet-visit-error-notes" accessibilityRole="alert" className="text-sm text-red-700">
              {FIELD_ERROR_STRINGS.notes[errors.notes]}
            </Text>
          ) : null}

          <HealthLogPhotoPicker petId={petId} onKeysChange={setPhotoKeys} />

          <PrimaryButton
            testID="add-vet-visit-save"
            label={strings.vetVisit.save}
            onPress={handleSave}
            loading={submitting}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
