import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthStore } from "../src/auth/auth-store";
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
    <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
      <Text className="text-xl font-semibold text-brand-900">
        {strings.auth.pushRationale.title}
      </Text>
      <Text className="text-center text-base text-brand-900">
        {strings.auth.pushRationale.body}
      </Text>
      <PrimaryButton
        testID="push-rationale-enable"
        label={strings.auth.pushRationale.enable}
        onPress={handleEnable}
        loading={loading}
      />
      <Pressable testID="push-rationale-skip" onPress={finish}>
        <Text className="text-center text-sm font-medium text-brand-700">
          {strings.auth.pushRationale.skip}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}
