import { forwardRef, useImperativeHandle, useState } from "react";
import { Text, TextInput, useColorScheme, View } from "react-native";

import { validateNoteForm, type NoteFormError } from "../health-logs/health-log-forms";
import { strings } from "../strings";
import { HealthLogPhotoPicker } from "./health-log-photo-picker";

export interface AddNoteFormProps {
  petId: string;
  submitting: boolean;
  onSubmit: (input: { text: string; photoKeys: string[] }) => void;
}

export interface AddNoteFormHandle {
  submit: () => void;
}

const ERROR_STRINGS: Record<NoteFormError, string> = {
  empty: strings.note.errorEmpty,
  tooLong: strings.note.errorTooLong,
};

/**
 * The "add note" quick-action form body (T066 plan). CRAFT-1 §7.4: this now
 * renders ONLY the field group — the save button moved to the screen's
 * `ScreenScaffold` `footer` (bottom-pinned thumb zone), so this component
 * exposes a `submit()` imperative handle instead of owning the button or the
 * keyboard-avoidance/scroll (those now live on the screen). `submitting`
 * stays part of the prop shape (the footer button reads its own loading
 * state directly) so callers are unaffected. Validates through the shared
 * `noteValueSchema` (`validateNoteForm`) before ever calling `onSubmit`;
 * photos are optional and collected via `HealthLogPhotoPicker`.
 */
export const AddNoteForm = forwardRef<AddNoteFormHandle, AddNoteFormProps>(function AddNoteForm(
  { petId, onSubmit },
  ref,
) {
  const [text, setText] = useState("");
  const [photoKeys, setPhotoKeys] = useState<string[]>([]);
  const [error, setError] = useState<NoteFormError | null>(null);
  const scheme = useColorScheme();
  const placeholderColor = scheme === "dark" ? "#9AA8A1" : "#2f8f74";

  function handleSave() {
    const result = validateNoteForm(text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    onSubmit({ text: result.value.text, photoKeys });
  }

  useImperativeHandle(ref, () => ({ submit: handleSave }));

  return (
    <View className="gap-4">
      <TextInput
        testID="add-note-input"
        value={text}
        onChangeText={setText}
        multiline
        placeholder={strings.note.inputPlaceholder}
        placeholderTextColor={placeholderColor}
        className="min-h-[120px] rounded-lg border border-brand-100 dark:border-hairline-dark dark:bg-surface-card-dark px-4 py-3 text-base text-brand-900 dark:text-ink-dark"
      />
      <HealthLogPhotoPicker petId={petId} onKeysChange={setPhotoKeys} />
      {error !== null ? (
        <Text testID="add-note-error" accessibilityRole="alert" className="text-sm text-red-700 dark:text-red-400">
          {ERROR_STRINGS[error]}
        </Text>
      ) : null}
    </View>
  );
});
