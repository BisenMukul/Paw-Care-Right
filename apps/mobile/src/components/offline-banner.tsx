import { useIsOffline } from "@pawcareright/api-client";
import type { ReactElement } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { strings } from "../strings";

/**
 * Global, root-mounted offline banner (T094 plan D2/step 7). Renders `null`
 * while online. Rendered in NORMAL DOCUMENT FLOW, above `<Stack>` — a top
 * strip that pushes content down. It must NEVER be `absolute`/`z`-layered:
 * an overlay could cover the Emergency interstitial's hotline numbers
 * (PRODUCT_SPEC §5 / CLAUDE §7 rule 4). Non-dismissible chrome, not a
 * control -- no `onPress`, no dismiss affordance (mirrors `VetDisclaimer`).
 */
export function OfflineBanner(): ReactElement | null {
  const isOffline = useIsOffline();
  const insets = useSafeAreaInsets();

  if (!isOffline) {
    return null;
  }

  return (
    <View
      testID="offline-banner"
      accessibilityRole="alert"
      // Dynamic value only (CLAUDE §6) -- the banner sits above every
      // screen's own `SafeAreaView edges={["top"]}`.
      style={{ paddingTop: insets.top }}
      className="bg-brand-700 dark:bg-accent-dark px-4 pb-2"
    >
      <Text maxFontSizeMultiplier={1.5} className="text-center text-sm font-body text-white">
        {strings.offline.banner}
      </Text>
    </View>
  );
}
