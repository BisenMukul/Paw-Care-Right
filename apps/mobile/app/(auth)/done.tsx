import { useRouter } from "expo-router";
import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PrimaryButton } from "../../src/components/primary-button";
import { strings } from "../../src/strings";

export default function DoneScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-brand-50 dark:bg-surface-page-dark px-6">
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={1.5}
        className="text-2xl font-bold text-brand-900 dark:text-ink-dark font-display"
      >
        {strings.auth.done.title}
      </Text>
      <Text className="text-center text-base text-brand-900 dark:text-ink-dark font-body">
        {strings.auth.done.body}
      </Text>
      <PrimaryButton
        testID="done-continue"
        label={strings.auth.done.continue}
        onPress={() => router.replace("/push-rationale")}
      />
    </SafeAreaView>
  );
}
