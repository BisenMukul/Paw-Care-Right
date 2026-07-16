import { useRouter } from "expo-router";
import { Modal, Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useUpsellStore } from "../billing/upsell-store";
import { strings } from "../strings";

/**
 * Global, dismissible upsell sheet (T075 plan decision 7). Mounted once at
 * the app root; visibility is driven entirely by `useUpsellStore` (set by
 * the central `MutationCache.onError` interceptor on a `PAYMENT_REQUIRED`
 * failure, unless the mutation opts out via `meta.skipUpsell`). Renders
 * nothing when hidden — structurally incapable of appearing on the
 * emergency/red-flag path (that path never produces a 402, and the check
 * mutation itself carries `skipUpsell`).
 */
export function UpsellSheet() {
  const router = useRouter();
  const visible = useUpsellStore((state) => state.visible);
  const hide = useUpsellStore((state) => state.hide);

  if (!visible) {
    return null;
  }

  function handleSeePlans() {
    hide();
    router.push({ pathname: "/paywall", params: { source: "upsell" } });
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={hide}>
      <Pressable testID="upsell-sheet-backdrop" className="flex-1 justify-end bg-black/40" onPress={hide}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <SafeAreaView testID="upsell-sheet" className="gap-3 rounded-t-2xl bg-white px-6 pb-4 pt-6">
            <Text className="text-center text-lg font-semibold text-brand-900">{strings.upsell.title}</Text>
            <Text className="text-center text-base text-brand-700">{strings.upsell.body}</Text>
            <Pressable
              testID="upsell-see-plans"
              accessibilityRole="button"
              onPress={handleSeePlans}
              className="items-center rounded-lg bg-brand-700 px-6 py-3"
            >
              <Text className="text-base font-semibold text-white">{strings.upsell.seePlans}</Text>
            </Pressable>
            <Pressable testID="upsell-dismiss" accessibilityRole="button" onPress={hide} className="items-center py-2">
              <Text className="text-sm text-brand-700">{strings.upsell.dismiss}</Text>
            </Pressable>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
