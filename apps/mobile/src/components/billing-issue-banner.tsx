import { Pressable, Text, View } from "react-native";

import { useEntitlement } from "../api/billing-api";
import { useBillingBannerStore } from "../billing/billing-banner-store";
import { openManageSubscription } from "../billing/manage-subscription";
import { strings } from "../strings";

/**
 * Factual, informational billing banner (T076 plan): renders ONLY when the
 * server-mirrored entitlement carries `billingIssue: true` and the user has
 * not already dismissed it this session. Lives on the Settings screen only
 * -- structurally incapable of appearing on the check/intake/result/
 * emergency path. Not a §5 safety surface: no diagnosis/dose/medication
 * copy, no emergency escalation.
 */
export function BillingIssueBanner() {
  const { data } = useEntitlement();
  const dismissed = useBillingBannerStore((state) => state.dismissed);
  const dismiss = useBillingBannerStore((state) => state.dismiss);

  if (data?.billingIssue !== true || dismissed) {
    return null;
  }

  return (
    <View testID="billing-issue-banner" className="w-full rounded-lg bg-amber-100 px-4 py-3">
      <Text className="text-sm text-amber-950">{strings.settings.billingIssue.body}</Text>
      <View className="mt-3 flex-row gap-4">
        <Pressable
          testID="billing-issue-fix"
          onPress={() => void openManageSubscription()}
          accessibilityRole="button"
        >
          <Text className="text-sm font-semibold text-amber-950">{strings.settings.billingIssue.fix}</Text>
        </Pressable>
        <Pressable testID="billing-issue-dismiss" onPress={dismiss} accessibilityRole="button">
          <Text className="text-sm font-semibold text-amber-950">{strings.settings.billingIssue.dismiss}</Text>
        </Pressable>
      </View>
    </View>
  );
}
