import { isTerminalCheckStatus } from "@pawcareright/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCheck } from "../../../src/api/checks-api";
import { GhostButton } from "../../../src/components/ghost-button";
import { strings } from "../../../src/strings";

/**
 * Calm, cancel-safe polling screen (T047 plan "Flow & navigation contract").
 * `useCheck` polls every 1.5s until the check reaches a terminal status
 * (DONE or FALLBACK, D6) — both route identically to the T048 result screen
 * (`/check/result/[checkId]`), since a safe fallback is a first-class
 * terminal outcome, never an error (§7 rule 5). Cancel/back navigates away
 * (D7): the server job keeps running, and leaving unmounts `useCheck`,
 * which stops the polling — no client-side abort call.
 */
export default function CheckWaitingScreen() {
  const router = useRouter();
  const { checkId, petId } = useLocalSearchParams<{ checkId?: string; petId?: string }>();
  const { data } = useCheck(checkId ?? "");
  const scheme = useColorScheme();
  const spinnerColor = scheme === "dark" ? "#2EA57C" : "#1f6350";

  useEffect(() => {
    if (data !== undefined && isTerminalCheckStatus(data.status)) {
      router.replace({ pathname: "/check/result/[checkId]", params: { checkId: checkId ?? "" } });
    }
  }, [data, checkId, router]);

  function handleCancel() {
    router.replace({ pathname: "/pets/[id]", params: { id: petId ?? "" } });
  }

  return (
    <SafeAreaView
      testID="check-waiting-screen"
      className="flex-1 items-center justify-center gap-4 bg-brand-50 dark:bg-surface-page-dark px-6"
    >
      <ActivityIndicator testID="check-waiting-spinner" color={spinnerColor} />
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={1.5}
        className="text-center text-lg font-semibold text-brand-900 dark:text-ink-dark font-display-semibold"
      >
        {strings.check.waiting.title}
      </Text>
      <Text className="text-center text-base text-brand-700 dark:text-ink-muted-dark font-body">{strings.check.waiting.body}</Text>
      <GhostButton testID="check-waiting-cancel" label={strings.check.waiting.cancel} onPress={handleCancel} />
    </SafeAreaView>
  );
}
