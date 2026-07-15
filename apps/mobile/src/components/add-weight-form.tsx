import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { strings } from "../strings";
import { parseDisplayToGrams, type WeightUnit } from "../weight/weight-units";
import { PrimaryButton } from "./primary-button";

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
        <SafeAreaView className="bg-white">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View className="gap-4 p-6">
              <Text className="text-lg font-semibold text-brand-900">{strings.weight.addWeight}</Text>
              <View className="flex-row items-center gap-2">
                <TextInput
                  testID="add-weight-input"
                  value={input}
                  onChangeText={setInput}
                  keyboardType="decimal-pad"
                  placeholder={strings.weight.inputPlaceholder}
                  className="flex-1 rounded-lg border border-brand-300 px-4 py-3 text-base text-brand-900"
                />
                <Text className="text-base text-brand-700">{strings.weight.unitLabel[unit]}</Text>
              </View>
              {error !== null ? (
                <Text testID="add-weight-error" className="text-sm text-red-600">
                  {ERROR_STRINGS[error]}
                </Text>
              ) : null}
              <View className="flex-row justify-end gap-4">
                <Pressable testID="add-weight-cancel" onPress={handleClose} accessibilityRole="button">
                  <Text className="text-base font-medium text-brand-700">{strings.weight.cancel}</Text>
                </Pressable>
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
