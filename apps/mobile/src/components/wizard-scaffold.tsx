import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { strings } from "../strings";
import { PrimaryButton } from "./primary-button";

export interface WizardScaffoldProps {
  step: number;
  total: number;
  onNext?: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
  onSkip?: () => void;
  skipLabel?: string;
  onBack?: () => void;
  children: ReactNode;
}

/** Shared step chrome for the add-pet wizard (T024 plan). */
export function WizardScaffold({
  step,
  total,
  onNext,
  nextDisabled = false,
  nextLabel,
  onSkip,
  skipLabel,
  onBack,
  children,
}: WizardScaffoldProps) {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-1 px-6 py-4">
          <Text testID="wizard-progress" className="text-center text-sm text-brand-700">
            {strings.addPet.common.stepOf(step, total)}
          </Text>
          <View className="flex-1 gap-4 pt-4">{children}</View>
          <View className="flex-row items-center justify-between gap-4 pt-4">
            {onBack ? (
              <Pressable testID="wizard-back" onPress={onBack}>
                <Text className="text-base font-medium text-brand-700">
                  {strings.addPet.common.back}
                </Text>
              </Pressable>
            ) : (
              <View />
            )}
            <View className="flex-row items-center gap-4">
              {onSkip ? (
                <Pressable testID="wizard-skip" onPress={onSkip}>
                  <Text className="text-base font-medium text-brand-700">
                    {skipLabel ?? strings.addPet.common.skip}
                  </Text>
                </Pressable>
              ) : null}
              {onNext ? (
                <PrimaryButton
                  testID="wizard-next"
                  label={nextLabel ?? strings.addPet.common.next}
                  onPress={onNext}
                  disabled={nextDisabled}
                />
              ) : null}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
