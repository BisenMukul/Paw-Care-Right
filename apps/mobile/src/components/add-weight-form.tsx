import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { strings } from "../strings";
import { parseDisplayToGrams, type WeightUnit } from "../weight/weight-units";
import { GhostButton } from "./ghost-button";
import { PrimaryButton } from "./primary-button";
import { TextField } from "./text-field";

export interface AddWeightFormProps {
  visible: boolean;
  unit: WeightUnit;
  submitting: boolean;
  onSubmit: (grams: number) => void;
  onClose: () => void;
}

type ParseErrorReason = "empty" | "nan" | "range";

const ERROR_STRINGS: Record<ParseErrorReason, string> = {
  empty: strings.weight.errorEmpty,
  nan: strings.weight.errorInvalid,
  range: strings.weight.errorRange,
};

/**
 * The "add weight" quick-action form (T065 plan) — a bottom-sheet-style
 * modal card with a decimal-pad input in the caller's current display
 * unit. Validates via `parseDisplayToGrams` and only ever calls `onSubmit`
 * with storage-source-of-truth grams; no medical/interpretive copy
 * anywhere here (CLAUDE §7).
 */
export function AddWeightForm({ visible, unit, submitting, onSubmit, onClose }: AddWeightFormProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<ParseErrorReason | null>(null);

  function handleClose() {
    setInput("");
    setError(null);
    onClose();
  }

  function handleSave() {
    const result = parseDisplayToGrams(input, unit);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setError(null);
    onSubmit(result.grams);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 justify-end bg-black/40">
        <SafeAreaView className="rounded-t-2xl bg-white">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View className="gap-4 p-6">
              <View className="flex-row items-end gap-2">
                <View className="flex-1">
                  <TextField
                    testID="add-weight-input"
                    label={strings.weight.addWeight}
                    value={input}
                    onChangeText={setInput}
                    keyboardType="decimal-pad"
                    placeholder={strings.weight.inputPlaceholder}
                  />
                </View>
                <Text className="pb-3 text-base text-brand-700">{strings.weight.unitLabel[unit]}</Text>
              </View>
              {error !== null ? (
                <Text testID="add-weight-error" accessibilityRole="alert" className="text-sm text-red-700">
                  {ERROR_STRINGS[error]}
                </Text>
              ) : null}
              <View className="flex-row justify-end gap-4">
                <GhostButton testID="add-weight-cancel" label={strings.weight.cancel} onPress={handleClose} />
                <PrimaryButton
                  testID="add-weight-save"
                  label={strings.weight.save}
                  onPress={handleSave}
                  loading={submitting}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
