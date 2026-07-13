import { APP_DISPLAY_NAME } from "@pawcareright/config";
import { Text, View } from "react-native";

import { strings } from "../strings";

/**
 * Shared, non-dismissible vet-consult disclaimer (T048 plan — the phase's
 * primary PRODUCT_SPEC §5 mobile surface). Plain `View`/`Text` only: no
 * `Pressable`, no close/onPress affordance, so there is no way to dismiss
 * it. Rendered on every AI content state (all 5 urgency tiers + FALLBACK).
 */
export function VetDisclaimer() {
  return (
    <View testID="vet-disclaimer" accessibilityRole="text" className="rounded-lg bg-brand-50 px-4 py-3">
      <Text className="text-center text-sm text-brand-900">{strings.check.result.disclaimer(APP_DISPLAY_NAME)}</Text>
    </View>
  );
}
