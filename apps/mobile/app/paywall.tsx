import { APP_DISPLAY_NAME } from "@pawcareright/config";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { captureEvent } from "../src/analytics/analytics";
import { useAuthStore } from "../src/auth/auth-store";
import { usePaywallConfig, useOfferings } from "../src/billing/paywall-queries";
import { usePremiumStore } from "../src/billing/premium-store";
import type { PaywallPackage } from "../src/billing/paywall-types";
import { purchasePackage, restorePurchases } from "../src/billing/purchases";
import { GhostButton } from "../src/components/ghost-button";
import { PrimaryButton } from "../src/components/primary-button";
import { getConfig } from "../src/config";
import { useLayoutBucket } from "../src/hooks/use-layout-bucket";
import { strings } from "../src/strings";

type Notice = "none" | "pending" | "error" | "restoreNone" | "success";

/**
 * The paywall screen (T074 plan): a dismissible modal reached from
 * `check/index.tsx` (onboarding, one-time) or the Settings "Upgrade" row.
 * It NEVER gates a check and is NEVER on the intake/submit/red-flag/
 * emergency path (see `use-paywall-trigger.ts`'s header comment for the
 * structural guarantee). Prices/trial come exclusively from the RC
 * offering (`useOfferings`); copy is entirely client-side (`strings.paywall`),
 * chosen by the server-sent A/B variant (`usePaywallConfig`, offline-safe
 * default `"A"`).
 */
export default function PaywallScreen() {
  const router = useRouter();
  // `source` (`"onboarding" | "settings"`) drives the `paywall_view`
  // analytics event below; it does not otherwise change this screen's
  // rendering or navigation.
  const params = useLocalSearchParams<{ source?: string }>();

  // Mount-once emission (T078 plan): `[]` deps so remounting the screen
  // (not just re-rendering) is what re-fires this, matching "once per view".
  useEffect(() => {
    const householdId = useAuthStore.getState().householdId;
    captureEvent("paywall_view", {
      source: params.source === "settings" ? "settings" : "onboarding",
      // `householdId` is optional (not `string | undefined`) under this
      // repo's `exactOptionalPropertyTypes` -- a conditional spread (rather
      // than `?? undefined`) omits the key entirely when there is none.
      ...(householdId !== null ? { householdId } : {}),
    });
    // Intentional mount-once emission -- `[]` deps, not a reactive effect on params/store.
  }, []);

  const { data: config } = usePaywallConfig();
  const { data: offering, isLoading: offeringLoading } = useOfferings();
  const setFromCustomerInfo = usePremiumStore((state) => state.setFromCustomerInfo);
  const setStatus = usePremiumStore((state) => state.setStatus);
  const bucket = useLayoutBucket();
  const isWide = bucket === "wide";
  const contentClassName = isWide ? "gap-6 px-4 pb-8 pt-4 w-full max-w-2xl self-center" : "gap-6 px-4 pb-8 pt-4";
  const ctaFooterClassName = isWide
    ? "border-t border-brand-100 dark:border-hairline-dark bg-surface-page dark:bg-surface-page-dark px-4 pb-6 pt-3 w-full max-w-2xl self-center"
    : "border-t border-brand-100 dark:border-hairline-dark bg-surface-page dark:bg-surface-page-dark px-4 pb-6 pt-3";

  const [busyPackageId, setBusyPackageId] = useState<string | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>("none");

  const variant = config?.variant ?? "A";
  const copy = strings.paywall.variants[variant];

  const annual = offering?.packages.find((p) => p.id === "annual");
  const monthly = offering?.packages.find((p) => p.id === "monthly");
  const family = offering?.packages.find((p) => p.id === "family");

  const isBusy = busyPackageId !== null || restoreBusy;

  async function handlePurchase(pkg: PaywallPackage) {
    setNotice("none");
    setBusyPackageId(pkg.id);
    const outcome = await purchasePackage(pkg);
    setBusyPackageId(null);

    switch (outcome.status) {
      case "success":
        setFromCustomerInfo(outcome.customerInfo);
        setNotice("success");
        router.back();
        break;
      case "cancelled":
        // Stays mounted, no navigation, no error notice (plan AC).
        break;
      case "pending":
        setNotice("pending");
        break;
      case "error":
        setNotice("error");
        break;
    }
  }

  async function handleRestore() {
    setNotice("none");
    setRestoreBusy(true);
    const outcome = await restorePurchases();
    setRestoreBusy(false);

    if (outcome.status === "success" && outcome.entitled) {
      setStatus("entitled");
      setNotice("success");
      router.back();
    } else if (outcome.status === "success") {
      setNotice("restoreNone");
    } else {
      setNotice("error");
    }
  }

  function handleMaybeLater() {
    router.back();
  }

  return (
    <SafeAreaView testID="paywall-screen" className="flex-1 bg-surface-page dark:bg-surface-page-dark">
      <View className="relative flex-1">
        <ScrollView testID="paywall-scroll" className="flex-1">
          <View className={contentClassName}>
            <Text testID="paywall-headline" className="text-3xl font-bold text-brand-900 dark:text-ink-dark font-display">
              {copy.headline(APP_DISPLAY_NAME)}
            </Text>
            <Text testID="paywall-subcopy" className="text-base text-brand-700 dark:text-ink-muted-dark font-body">
              {copy.subcopy}
            </Text>

            {notice === "pending" ? (
              <View testID="paywall-pending-notice" className="rounded-2xl bg-amber-100 px-4 py-3">
                <Text className="text-center text-sm text-amber-950">{strings.paywall.pending}</Text>
              </View>
            ) : null}
            {notice === "error" ? (
              <View testID="paywall-error-notice" className="rounded-2xl bg-red-100 px-4 py-3">
                <Text className="text-center text-sm text-red-800">{strings.paywall.error}</Text>
              </View>
            ) : null}
            {notice === "restoreNone" ? (
              <View testID="paywall-restore-none" className="rounded-2xl bg-amber-100 px-4 py-3">
                <Text className="text-center text-sm text-amber-950">{strings.paywall.restoreNone}</Text>
              </View>
            ) : null}
            {notice === "success" ? (
              <View testID="paywall-success" className="rounded-2xl bg-green-100 px-4 py-3">
                <Text className="text-center text-sm text-green-900">{strings.paywall.success}</Text>
              </View>
            ) : null}

            {offeringLoading ? (
              <View testID="paywall-offerings-loading" className="items-center py-8">
                <ActivityIndicator />
              </View>
            ) : offering === null || offering === undefined ? (
              <View testID="paywall-unavailable" className="rounded-2xl bg-brand-50 dark:bg-surface-raised-dark px-4 py-3">
                <Text className="text-center text-sm text-brand-700 dark:text-ink-muted-dark">{strings.paywall.unavailable}</Text>
              </View>
            ) : (
              <View className="gap-3">
                {annual ? (
                  <Pressable
                    testID="paywall-plan-annual"
                    accessibilityRole="button"
                    onPress={() => handlePurchase(annual)}
                    disabled={isBusy}
                    className="gap-1 rounded-2xl border-2 border-brand-700 dark:border-accent-bright bg-white dark:bg-surface-card-dark p-4 shadow-md"
                  >
                    <View
                      testID="paywall-plan-annual-highlight"
                      className="self-start rounded-full bg-brand-700 dark:bg-accent-dark px-2 py-1"
                    >
                      <Text className="text-xs font-semibold text-white">{strings.paywall.annualBadge}</Text>
                    </View>
                    <Text className="text-base font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
                      {strings.paywall.planNames.annual}
                    </Text>
                    <Text testID="paywall-price-annual" className="text-base text-brand-700 dark:text-ink-muted-dark font-body">
                      {annual.priceString}
                    </Text>
                  </Pressable>
                ) : null}

                {monthly ? (
                  <Pressable
                    testID="paywall-plan-monthly"
                    accessibilityRole="button"
                    onPress={() => handlePurchase(monthly)}
                    disabled={isBusy}
                    className="gap-1 rounded-2xl bg-white dark:bg-surface-card-dark p-4 shadow-md"
                  >
                    <Text className="text-base font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
                      {strings.paywall.planNames.monthly}
                    </Text>
                    <Text testID="paywall-price-monthly" className="text-base text-brand-700 dark:text-ink-muted-dark font-body">
                      {monthly.priceString}
                    </Text>
                    <Text testID="paywall-trial-badge" className="text-xs text-brand-700 dark:text-ink-muted-dark font-body">
                      {strings.paywall.trialCta}
                    </Text>
                  </Pressable>
                ) : null}

                {family ? (
                  <Pressable
                    testID="paywall-plan-family"
                    accessibilityRole="button"
                    onPress={() => handlePurchase(family)}
                    disabled={isBusy}
                    className="gap-1 rounded-2xl bg-white dark:bg-surface-card-dark p-4 shadow-md"
                  >
                    <Text className="text-base font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
                      {strings.paywall.planNames.family}
                    </Text>
                    <Text testID="paywall-price-family" className="text-base text-brand-700 dark:text-ink-muted-dark font-body">
                      {family.priceString}
                    </Text>
                    <Text testID="paywall-family-explainer" className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">
                      {strings.paywall.familyExplainer}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            )}

            <View className="items-center">
              <GhostButton
                testID="paywall-restore"
                label={strings.paywall.restore}
                onPress={handleRestore}
                disabled={isBusy}
              />
            </View>

            <View className="flex-row justify-center gap-6">
              <Pressable
                testID="paywall-terms"
                accessibilityRole="link"
                onPress={() => void Linking.openURL(getConfig().termsUrl)}
              >
                <Text className="text-xs text-brand-700 dark:text-accent-bright underline">{strings.paywall.terms}</Text>
              </Pressable>
              <Pressable
                testID="paywall-privacy"
                accessibilityRole="link"
                onPress={() => void Linking.openURL(getConfig().privacyUrl)}
              >
                <Text className="text-xs text-brand-700 dark:text-accent-bright underline">{strings.paywall.privacy}</Text>
              </Pressable>
            </View>

            <View className="items-center">
              <GhostButton testID="paywall-maybe-later" label={strings.paywall.maybeLater} onPress={handleMaybeLater} />
            </View>
          </View>
        </ScrollView>

        {monthly ? (
          <View className={ctaFooterClassName}>
            <PrimaryButton
              testID="paywall-trial-cta"
              label={
                monthly.introPriceString !== undefined
                  ? strings.paywall.trialCtaWithPrice(monthly.introPriceString)
                  : strings.paywall.subscribeCta(monthly.priceString)
              }
              loading={busyPackageId === monthly.id}
              disabled={isBusy}
              onPress={() => handlePurchase(monthly)}
            />
          </View>
        ) : null}

        {isBusy ? (
          <View
            testID="paywall-busy"
            className="absolute inset-0 items-center justify-center bg-white/70 dark:bg-surface-page-dark/70"
          >
            <ActivityIndicator />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
