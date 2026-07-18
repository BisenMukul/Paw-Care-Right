import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { strings } from "../src/strings";

/**
 * Tiny reusable placeholder screen (T025 plan). All three pet-home stubs
 * ("Something wrong?", Log weight, Reminders) navigate here. Copy is neutral
 * and non-medical (CLAUDE.md §7) — no diagnosis/guidance language, whatever
 * `feature` the caller passed.
 */
export default function ComingSoonScreen() {
  return (
    <SafeAreaView
      testID="coming-soon-screen"
      className="flex-1 items-center justify-center gap-3 bg-brand-50 px-6"
    >
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.5} className="text-xl font-semibold text-brand-900">
        {strings.comingSoon.title}
      </Text>
      <Text className="text-center text-base text-brand-900">{strings.comingSoon.body}</Text>
    </SafeAreaView>
  );
}
