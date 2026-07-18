import type { VetVisitValue } from "@pawcareright/types";
import { forwardRef, useImperativeHandle, useState } from "react";
import { Text, TextInput, useColorScheme, View } from "react-native";

import { validateVetVisitForm, type VetVisitFormErrors } from "../health-logs/health-log-forms";
import { strings } from "../strings";
import { HealthLogPhotoPicker } from "./health-log-photo-picker";
import { TextField } from "./text-field";

export interface AddVetVisitFormProps {
  petId: string;
  submitting: boolean;
  onSubmit: (value: VetVisitValue, photoKeys: string[]) => void;
}

export interface AddVetVisitFormHandle {
  submit: () => void;
}

const FIELD_ERROR_STRINGS = {
  reason: { empty: strings.vetVisit.errorReasonEmpty, tooLong: strings.vetVisit.errorTooLong },
  clinicName: { empty: strings.vetVisit.errorTooLong, tooLong: strings.vetVisit.errorTooLong },
  notes: { empty: strings.vetVisit.errorTooLong, tooLong: strings.vetVisit.errorTooLong },
} as const;

/**
 * The "vet visit" quick-action form body (T066 plan) — record-only fields,
 * no cost/med/dose field (decision 5 / CLAUDE §7). CRAFT-1 §7.4: renders
 * ONLY the field group now — the save button moved to the screen's
 * `ScreenScaffold` `footer`, so this component exposes a `submit()`
 * imperative handle instead of owning the button/keyboard-avoidance/scroll.
 * `submitting` stays part of the prop shape (the footer button reads its own
 * loading state directly) so callers are unaffected. Validates through the
 * shared `vetVisitValueSchema` (`validateVetVisitForm`) before ever calling
 * `onSubmit`.
 */
export const AddVetVisitForm = forwardRef<AddVetVisitFormHandle, AddVetVisitFormProps>(function AddVetVisitForm(
  { petId, onSubmit },
  ref,
) {
  const [reason, setReason] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [notes, setNotes] = useState("");
  const [photoKeys, setPhotoKeys] = useState<string[]>([]);
  const [errors, setErrors] = useState<VetVisitFormErrors>({});
  const scheme = useColorScheme();
  const placeholderColor = scheme === "dark" ? "#9AA8A1" : "#2f8f74";

  function handleSave() {
    const result = validateVetVisitForm({ reason, clinicName, notes });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    onSubmit(result.value, photoKeys);
  }

  useImperativeHandle(ref, () => ({ submit: handleSave }));

  return (
    <View className="gap-4">
      <TextField
        testID="add-vet-visit-reason"
        label={strings.vetVisit.reasonPlaceholder}
        value={reason}
        onChangeText={setReason}
      />
      {errors.reason !== undefined ? (
        <Text testID="add-vet-visit-error-reason" accessibilityRole="alert" className="text-sm text-red-700 dark:text-red-400">
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
        <Text testID="add-vet-visit-error-clinic" accessibilityRole="alert" className="text-sm text-red-700 dark:text-red-400">
          {FIELD_ERROR_STRINGS.clinicName[errors.clinicName]}
        </Text>
      ) : null}

      <TextInput
        testID="add-vet-visit-notes"
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder={strings.vetVisit.notesPlaceholder}
        placeholderTextColor={placeholderColor}
        className="min-h-[100px] rounded-lg border border-brand-100 dark:border-hairline-dark dark:bg-surface-card-dark px-4 py-3 text-base text-brand-900 dark:text-ink-dark"
      />
      {errors.notes !== undefined ? (
        <Text testID="add-vet-visit-error-notes" accessibilityRole="alert" className="text-sm text-red-700 dark:text-red-400">
          {FIELD_ERROR_STRINGS.notes[errors.notes]}
        </Text>
      ) : null}

      <HealthLogPhotoPicker petId={petId} onKeysChange={setPhotoKeys} />
    </View>
  );
});
