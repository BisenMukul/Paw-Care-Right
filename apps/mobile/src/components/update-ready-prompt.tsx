import type { ReactElement } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useUpdateFlow, type UseUpdateFlowOverrides } from "../hooks/use-update-flow";
import { strings } from "../strings";

import { GhostButton } from "./ghost-button";
import { PrimaryButton } from "./primary-button";

export type UpdateReadyPromptProps = UseUpdateFlowOverrides;

/**
 * T114: the "Update ready" restart banner (docs/OTA_UPDATES.md §3 `H`/`I`).
 * Renders `null` whenever `useUpdateFlow` reports no pending, undeferred,
 * un-dismissed critical update -- this IS the deferral guard (see that
 * hook's header comment): it simply never renders during a protected flow,
 * so there is nothing to dismiss or race. Rendered in NORMAL DOCUMENT FLOW
 * (never `absolute`/`z`-layered), same rule as `OfflineBanner`/`BetaBanner` --
 * an overlay could cover the Emergency interstitial's hotline numbers. Not
 * an AI/triage surface, so no `<VetDisclaimer/>`. Props are optional test
 * seams only (mirrors `UpdateGate`'s own testability conventions) -- no
 * production call site passes them.
 */
export function UpdateReadyPrompt(props: UpdateReadyPromptProps = {}): ReactElement | null {
  const { promptVisible, restart, dismiss } = useUpdateFlow(props);
  const insets = useSafeAreaInsets();

  if (!promptVisible) {
    return null;
  }

  return (
    <View
      testID="update-ready-prompt"
      accessibilityRole="alert"
      accessibilityLabel={strings.updateReady.a11yLabel}
      style={{ paddingTop: insets.top }}
      className="flex-row items-center justify-between gap-3 bg-brand-50 dark:bg-surface-raised-dark px-4 pb-3"
    >
      <View className="flex-1 gap-1">
        <Text maxFontSizeMultiplier={1.5} className="text-sm font-semibold text-brand-900 dark:text-ink-dark">
          {strings.updateReady.title}
        </Text>
        <Text maxFontSizeMultiplier={1.5} className="text-xs text-brand-700 dark:text-ink-muted-dark">
          {strings.updateReady.body}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <GhostButton
          testID="update-ready-prompt-later"
          label={strings.updateReady.laterCta}
          onPress={dismiss}
        />
        <PrimaryButton
          testID="update-ready-prompt-restart"
          label={strings.updateReady.restartCta}
          onPress={restart}
        />
      </View>
    </View>
  );
}
