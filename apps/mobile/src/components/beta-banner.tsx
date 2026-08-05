import { useIsOffline } from "@bombaypetcompany/api-client";
import { useRouter } from "expo-router";
import type { ReactElement } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getConfig } from "../config";
import { strings } from "../strings";

/**
 * T104 plan D6: root-mounted, flag-gated, NON-DISMISSIBLE beta notice with a
 * feedback CTA. Rendered in NORMAL DOCUMENT FLOW -- it must NEVER be
 * `absolute`/`z`-layered, exactly like `OfflineBanner` (an overlay could
 * cover the Emergency interstitial's hotline numbers, §7 rule 4). Renders
 * `null` when the `betaBanner` config flag is off (default -- nothing
 * changes for non-beta builds). Chrome, not an alert -- no
 * `accessibilityRole="alert"` (unlike `OfflineBanner`; a permanent beta
 * notice is not urgent).
 */
export function BetaBanner(): ReactElement | null {
  const router = useRouter();
  const isOffline = useIsOffline();
  const insets = useSafeAreaInsets();
  const { betaBanner } = getConfig();

  if (!betaBanner) {
    return null;
  }

  return (
    <View
      testID="beta-banner"
      // Dynamic value only (CLAUDE §6): `OfflineBanner` already applies
      // `insets.top` while it renders (offline); this banner applies it
      // only when `OfflineBanner` is NOT rendering, so the two never
      // double-pad the safe area.
      style={{ paddingTop: isOffline ? 0 : insets.top }}
      className="flex-row items-center justify-between bg-brand-100 dark:bg-surface-raised-dark px-4 pb-2"
    >
      <Text maxFontSizeMultiplier={1.5} className="text-sm font-body text-brand-900 dark:text-ink-dark">
        {strings.feedback.betaBanner.label}
      </Text>
      <Pressable
        testID="beta-banner-cta"
        onPress={() => router.push("/feedback")}
        accessibilityRole="button"
        accessibilityLabel={strings.feedback.betaBanner.ctaA11yLabel}
      >
        <Text maxFontSizeMultiplier={1.5} className="text-sm font-semibold text-brand-700 dark:text-accent-bright">
          {strings.feedback.betaBanner.cta}
        </Text>
      </Pressable>
    </View>
  );
}
