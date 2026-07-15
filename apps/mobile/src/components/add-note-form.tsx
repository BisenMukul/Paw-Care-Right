import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";

import { validateNoteForm, type NoteFormError } from "../health-logs/health-log-forms";
import { strings } from "../strings";
import { HealthLogPhotoPicker } from "./health-log-photo-picker";
import { PrimaryButton } from "./primary-button";

export interface AddNoteFormProps {
  petId: string;
  submitting: boolean;
  onSubmit: (input: { text: string; photoKeys: string[] }) => void;
}

const ERROR_STRINGS: Record<NoteFormError, string> = {
  empty: strings.note.errorEmpty,
  tooLong: strings.note.errorTooLong,
};

/**
 * The "add note" quick-action form body (T066 plan) — this IS the screen
 * body (no intermediate "add" button, unlike the modal-based
 * `AddWeightForm`), so it owns keyboard-avoidance (§6) but not the
 * safe-area, which the screen already provides. Validates through the
 * shared `noteValueSchema` (`validateNoteForm`) before ever calling
 * `onSubmit`; photos are optional and collected via `HealthLogPhotoPicker`.
 */
export function AddNoteForm({ petId, submitting, onSubmit }: AddNoteFormProps) {
  const [text, setText] = useState("");
  const [photoKeys, setPhotoKeys] = useState<string[]>([]);
  const [error, setError] = useState<NoteFormError | null>(null);

  function handleSave() {
    const result = validateNoteForm(text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    onSubmit({ text: result.value.text, photoKeys });
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
      <ScrollView className="flex-1">
        <View className="gap-4 px-6 pb-8 pt-4">
          <TextInput
            testID="add-note-input"
            value={text}
            onChangeText={setText}
            multiline
            placeholder={strings.note.inputPlaceholder}
            className="min-h-[120px] rounded-lg border border-brand-300 px-4 py-3 text-base text-brand-900"
          />
          <HealthLogPhotoPicker petId={petId} onKeysChange={setPhotoKeys} />
          {error !== null ? (
            <Text testID="add-note-error" className="text-sm text-red-600">
              {ERROR_STRINGS[error]}
            </Text>
          ) : null}
          <PrimaryButton testID="add-note-save" label={strings.note.save} onPress={handleSave} loading={submitting} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
