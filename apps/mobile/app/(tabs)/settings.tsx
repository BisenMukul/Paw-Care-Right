import { APP_DISPLAY_NAME } from "@pawcareright/config";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useEntitlement } from "../../src/api/billing-api";
import { openManageSubscription } from "../../src/billing/manage-subscription";
import { usePremiumStore } from "../../src/billing/premium-store";
import { restorePurchases } from "../../src/billing/purchases";
import { BillingIssueBanner } from "../../src/components/billing-issue-banner";
import { strings } from "../../src/strings";

type RestoreNotice = "none" | "success" | "restoreNone" | "error";

export default function SettingsScreen() {
  const router = useRouter();
  const { data: entitlement } = useEntitlement();
  const setStatus = usePremiumStore((state) => state.setStatus);

  const [restoreBusy, setRestoreBusy] = useState(false);
  const [notice, setNotice] = useState<RestoreNotice>("none");

  async function handleRestore() {
    setNotice("none");
    setRestoreBusy(true);
    const outcome = await restorePurchases();
    setRestoreBusy(false);

    if (outcome.status === "success" && outcome.entitled) {
      setStatus("entitled");
      setNotice("success");
    } else if (outcome.status === "success") {
      setNotice("restoreNone");
    } else {
      setNotice("error");
    }
  }

  return (
    <SafeAreaView className="flex-1 items-center justify-center gap-6 bg-white px-6">
      <BillingIssueBanner />
      <Text className="text-center text-base text-brand-900">
        {strings.settings.body}
      </Text>
      <Pressable
        testID="settings-family"
        onPress={() => router.push("/family")}
        accessibilityRole="button"
        className="items-center rounded-lg bg-brand-700 px-6 py-3"
      >
        <Text className="text-base font-semibold text-white">{strings.settings.family}</Text>
      </Pressable>
      <Pressable
        testID="settings-notifications"
        onPress={() => router.push("/settings/notifications")}
        accessibilityRole="button"
        className="items-center rounded-lg bg-brand-700 px-6 py-3"
      >
        <Text className="text-base font-semibold text-white">{strings.settings.notifications}</Text>
      </Pressable>
      <Pressable
        testID="settings-premium"
        onPress={() => router.push({ pathname: "/paywall", params: { source: "settings" } })}
        accessibilityRole="button"
        className="items-center rounded-lg bg-brand-700 px-6 py-3"
      >
        <Text className="text-base font-semibold text-white">{strings.settings.premium(APP_DISPLAY_NAME)}</Text>
      </Pressable>
      {entitlement?.source === "own" ? (
        <Pressable
          testID="settings-manage"
          onPress={() => void openManageSubscription()}
          accessibilityRole="button"
          className="items-center rounded-lg bg-brand-700 px-6 py-3"
        >
          <Text className="text-base font-semibold text-white">{strings.settings.manage}</Text>
        </Pressable>
      ) : null}
      {entitlement?.entitled === true && entitlement.source === "family" ? (
        <View testID="settings-family-note" className="items-center rounded-lg bg-brand-50 px-6 py-3">
          <Text className="text-center text-sm text-brand-900">{strings.settings.familyManagedNote}</Text>
        </View>
      ) : null}
      <Pressable
        testID="settings-restore"
        onPress={() => void handleRestore()}
        disabled={restoreBusy}
        accessibilityRole="button"
        className="items-center rounded-lg bg-brand-700 px-6 py-3"
      >
        <Text className="text-base font-semibold text-white">{strings.settings.restore}</Text>
      </Pressable>
      {notice === "success" ? (
        <View testID="settings-restore-success" className="rounded-lg bg-green-100 px-4 py-3">
          <Text className="text-center text-sm text-green-900">{strings.settings.restoreSuccess}</Text>
        </View>
      ) : null}
      {notice === "restoreNone" ? (
        <View testID="settings-restore-none" className="rounded-lg bg-amber-100 px-4 py-3">
          <Text className="text-center text-sm text-amber-950">{strings.settings.restoreNone}</Text>
        </View>
      ) : null}
      {notice === "error" ? (
        <View testID="settings-restore-error" className="rounded-lg bg-red-100 px-4 py-3">
          <Text className="text-center text-sm text-red-800">{strings.settings.restoreError}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
