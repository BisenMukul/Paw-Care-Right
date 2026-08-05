import type { ReactElement } from "react";
import * as Linking from "expo-linking";
import { Platform, Pressable, Text, View } from "react-native";

import { useUpgradeBannerStore } from "../config/upgrade-banner-store";
import { useUpgradeState } from "../config/use-upgrade-state";
import { resolveStoreUpdateUrl } from "../config/store-update-url";
import { strings } from "../strings";

/**
 * T115: dismissible min<->recommended banner. Renders `null` unless the
 * launch-snapshotted `useUpgradeState()` is `"recommended"` AND the user has
 * not already dismissed it this session -- it can NEVER coexist with the
 * blocking `<UpdateGate/>` screen (`"blocked"` renders `null` here too;
 * `<UpdateGate/>` itself would not even mount this component's parent tree
 * in that case, but this is belt-and-braces).
 *
 * Structure mirrors `<OfflineBanner/>`/`<BetaBanner/>`: rendered in NORMAL
 * DOCUMENT FLOW, above `<Stack>` -- NEVER `absolute`/`z`-layered (an overlay
 * could cover the Emergency interstitial's hotline numbers, §7 rule 4). NO
 * `insets.top` (T114 Finding 6 lesson): this banner is mounted AFTER
 * `<OfflineBanner/>`/`<BetaBanner/>` in `_layout.tsx`, so it is never the
 * top-most element -- only a genuinely top-anchored banner should apply the
 * safe-area inset.
 */
export function UpgradeRecommendedBanner(): ReactElement | null {
  const upgradeState = useUpgradeState();
  const dismissed = useUpgradeBannerStore((state) => state.dismissed);
  const dismiss = useUpgradeBannerStore((state) => state.dismiss);

  if (upgradeState !== "recommended" || dismissed) {
    return null;
  }

  return (
    <View
      testID="upgrade-recommended-banner"
      className="flex-row items-center justify-between bg-brand-100 dark:bg-surface-raised-dark px-4 pb-2"
    >
      <Text maxFontSizeMultiplier={1.5} className="flex-1 text-sm font-body text-brand-900 dark:text-ink-dark">
        {strings.upgradeBanner.body}
      </Text>
      <View className="flex-row items-center gap-4">
        <Pressable
          testID="upgrade-banner-cta"
          onPress={() => void Linking.openURL(resolveStoreUpdateUrl(Platform.OS))}
          accessibilityRole="button"
        >
          <Text maxFontSizeMultiplier={1.5} className="text-sm font-semibold text-brand-700 dark:text-accent-bright">
            {strings.upgradeBanner.cta}
          </Text>
        </Pressable>
        <Pressable testID="upgrade-banner-dismiss" onPress={dismiss} accessibilityRole="button">
          <Text maxFontSizeMultiplier={1.5} className="text-sm font-semibold text-brand-700 dark:text-accent-bright">
            {strings.upgradeBanner.dismiss}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
