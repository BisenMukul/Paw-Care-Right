import { useRouter } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthStore } from "../src/auth/auth-store";
import { GhostButton } from "../src/components/ghost-button";
import { PrimaryButton } from "../src/components/primary-button";
import { usePushRegistration } from "../src/push/use-push-registration";
import { strings } from "../src/strings";

/**
 * Signed-in JIT push rationale screen (CLAUDE.md §6 — permissions requested
 * just-in-time with a rationale screen first). Both "Enable" and "Not now"
 * mark push as asked and continue into the app; registration failures are
 * swallowed (failure-tolerant, see `usePushRegistration`).
 */
export default function PushRationaleScreen() {
  const router = useRouter();
  const markPushAsked = useAuthStore((state) => state.markPushAsked);
  const { register } = usePushRegistration();
  const [loading, setLoading] = useState(false);

  function finish() {
    markPushAsked();
    router.replace("/(tabs)");
  }

  async function handleEnable() {
    setLoading(true);
    try {
      await register();
    } finally {
      setLoading(false);
      finish();
    }
  }

  return (
    <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-brand-50 dark:bg-surface-page-dark px-6">
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={1.5}
        className="text-xl font-semibold text-brand-900 dark:text-ink-dark font-display-semibold"
      >
        {strings.auth.pushRationale.title}
      </Text>
      <Text className="text-center text-base text-brand-900 dark:text-ink-dark font-body">
        {strings.auth.pushRationale.body}
      </Text>
      <PrimaryButton
        testID="push-rationale-enable"
        label={strings.auth.pushRationale.enable}
        onPress={handleEnable}
        loading={loading}
      />
      <GhostButton
        testID="push-rationale-skip"
        label={strings.auth.pushRationale.skip}
        onPress={finish}
      />
    </SafeAreaView>
  );
}
