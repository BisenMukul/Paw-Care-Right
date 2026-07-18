import { useRouter } from "expo-router";
import { Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useUpsellStore } from "../billing/upsell-store";
import { strings } from "../strings";
import { GhostButton } from "./ghost-button";
import { PrimaryButton } from "./primary-button";

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
          <SafeAreaView testID="upsell-sheet" className="mt-auto gap-4 rounded-t-2xl bg-white p-4 pb-8">
            <View className="h-1 w-10 self-center rounded-full bg-brand-200" />
            <Text className="text-center text-lg font-semibold text-brand-900">{strings.upsell.title}</Text>
            <Text className="text-center text-base text-brand-700">{strings.upsell.body}</Text>
            <PrimaryButton testID="upsell-see-plans" label={strings.upsell.seePlans} onPress={handleSeePlans} />
            <GhostButton testID="upsell-dismiss" label={strings.upsell.dismiss} onPress={hide} />
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
