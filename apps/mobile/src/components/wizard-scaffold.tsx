import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { strings } from "../strings";
import { GhostButton } from "./ghost-button";
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
    <SafeAreaView className="flex-1 bg-brand-50 dark:bg-surface-page-dark">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-1 px-6 py-4">
          <Text testID="wizard-progress" className="text-center text-sm text-brand-700 dark:text-ink-muted-dark font-body">
            {strings.addPet.common.stepOf(step, total)}
          </Text>
          <View className="flex-1 gap-4 pt-4">{children}</View>
          <View className="flex-row items-center justify-between gap-4 pt-4">
            {onBack ? (
              <GhostButton testID="wizard-back" label={strings.addPet.common.back} onPress={onBack} />
            ) : (
              <View />
            )}
            <View className="flex-row items-center gap-4">
              {onSkip ? (
                <GhostButton
                  testID="wizard-skip"
                  label={skipLabel ?? strings.addPet.common.skip}
                  onPress={onSkip}
                />
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
