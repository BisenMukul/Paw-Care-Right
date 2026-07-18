import { APP_DISPLAY_NAME } from "@pawcareright/config";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Switch, Text, View } from "react-native";

import { useConsentStore } from "../../src/analytics/consent-store";
import { useEntitlement } from "../../src/api/billing-api";
import { openManageSubscription } from "../../src/billing/manage-subscription";
import { usePremiumStore } from "../../src/billing/premium-store";
import { restorePurchases } from "../../src/billing/purchases";
import { BillingIssueBanner } from "../../src/components/billing-issue-banner";
import { Card } from "../../src/components/card";
import { ListRow } from "../../src/components/list-row";
import { ScreenScaffold } from "../../src/components/screen-scaffold";
import { strings } from "../../src/strings";

type RestoreNotice = "none" | "success" | "restoreNone" | "error";

export default function SettingsScreen() {
  const router = useRouter();
  const { data: entitlement } = useEntitlement();
  const setStatus = usePremiumStore((state) => state.setStatus);
  const analyticsEnabled = useConsentStore((state) => state.enabled);
  const setAnalyticsEnabled = useConsentStore((state) => state.setEnabled);

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
    <ScreenScaffold title={strings.settings.title} subtitle={strings.settings.body}>
      <BillingIssueBanner />

      <Card className="gap-0 p-0">
        <View className="px-4">
          <ListRow
            testID="settings-family"
            title={strings.settings.family}
            leadingIcon="people-outline"
            onPress={() => router.push("/family")}
          />
          <ListRow
            testID="settings-notifications"
            title={strings.settings.notifications}
            leadingIcon="notifications-outline"
            onPress={() => router.push("/settings/notifications")}
          />
          <ListRow
            testID="settings-premium"
            title={strings.settings.premium(APP_DISPLAY_NAME)}
            leadingIcon="star-outline"
            onPress={() => router.push({ pathname: "/paywall", params: { source: "settings" } })}
          />
          {entitlement?.source === "own" ? (
            <ListRow
              testID="settings-manage"
              title={strings.settings.manage}
              leadingIcon="card-outline"
              onPress={() => void openManageSubscription()}
            />
          ) : null}
          <ListRow
            testID="settings-restore"
            title={strings.settings.restore}
            leadingIcon="refresh-outline"
            onPress={() => void handleRestore()}
            disabled={restoreBusy}
          />
        </View>
      </Card>

      {entitlement?.entitled === true && entitlement.source === "family" ? (
        <View testID="settings-family-note" className="items-center rounded-lg bg-brand-50 px-6 py-3">
          <Text className="text-center text-sm text-brand-900">{strings.settings.familyManagedNote}</Text>
        </View>
      ) : null}

      <Card>
        <ListRow
          testID="settings-analytics-row"
          title={strings.settings.analyticsLabel}
          subtitle={strings.settings.analyticsHint}
          showChevron={false}
          trailing={
            <Switch testID="settings-analytics-toggle" value={analyticsEnabled} onValueChange={setAnalyticsEnabled} />
          }
        />
      </Card>

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
    </ScreenScaffold>
  );
}
