import { APP_DISPLAY_NAME } from "@bombaypetcompany/config";
import { isTerminalCheckStatus, SAFE_FALLBACK, type Urgency } from "@bombaypetcompany/types";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCheck } from "../../../src/api/checks-api";
import { buildSharePayload } from "../../../src/checks/share-payload";
import { URGENCY_DISPLAY } from "../../../src/checks/urgency-display";
import { buildVetSearchUrl } from "../../../src/checks/vet-search";
import { AppHeader } from "../../../src/components/app-header";
import { Card } from "../../../src/components/card";
import { GhostButton } from "../../../src/components/ghost-button";
import { PrimaryButton } from "../../../src/components/primary-button";
import { SecondaryButton } from "../../../src/components/secondary-button";
import { Skeleton } from "../../../src/components/skeleton";
import { VetDisclaimer } from "../../../src/components/vet-disclaimer";
import { useLayoutBucket } from "../../../src/hooks/use-layout-bucket";
import { useNavBack } from "../../../src/hooks/use-nav-back";
import { maybeRequestReview } from "../../../src/review/request-review";
import { recordEmergencySeen } from "../../../src/review/review-state";
import { strings } from "../../../src/strings";

/**
 * The T047 contract route: `/check/result/[checkId]`. This is the phase's
 * primary PRODUCT_SPEC §5 mobile surface (T048 plan). State precedence:
 * error (no data) -> loading (no data or non-terminal status) -> content.
 * Content always renders `<VetDisclaimer/>` (non-dismissible, §5 rule 1),
 * fails upward to `SAFE_FALLBACK` when the status is FALLBACK or the
 * terminal check is missing a result (D3 defensive guard, §7 rule 5), and
 * reinforces (never buries) any red-flag with an emergency notice above all
 * AI content (§7 rule 4).
 */
export default function CheckResultScreen() {
  const router = useRouter();
  const onBack = useNavBack("/(tabs)/timeline");
  const { checkId } = useLocalSearchParams<{ checkId?: string }>();
  const { data, isError, refetch } = useCheck(checkId ?? "");
  const bucket = useLayoutBucket();
  const contentClassName =
    bucket === "wide" ? "gap-6 px-4 pb-8 pt-4 w-full max-w-2xl self-center" : "gap-6 px-4 pb-8 pt-4";

  // T109: records an emergency sighting the moment this screen loads a
  // check carrying a red flag or an EMERGENCY_NOW/VET_24H tier -- runs
  // unconditionally (before any early return) so the hook order never
  // changes across renders (rules-of-hooks), and is itself a no-op read
  // until `data` resolves.
  useEffect(() => {
    if (!data) {
      return;
    }
    const urgency = data.result?.urgency;
    if (data.redFlag !== undefined || urgency === "EMERGENCY_NOW" || urgency === "VET_24H") {
      recordEmergencySeen();
    }
  }, [data]);

  if (isError && !data) {
    return (
      <SafeAreaView
        testID="check-result-error"
        className="flex-1 items-center justify-center gap-4 bg-surface-page dark:bg-surface-page-dark px-6"
      >
        <Text className="text-center text-base text-red-700 dark:text-red-400">{strings.check.result.error}</Text>
        <Text className="text-center text-sm text-brand-700 dark:text-ink-muted-dark">{strings.check.result.errorHint}</Text>
        <PrimaryButton
          testID="check-result-retry"
          label={strings.check.result.retry}
          onPress={() => refetch()}
        />
      </SafeAreaView>
    );
  }

  if (!data || !isTerminalCheckStatus(data.status)) {
    return (
      <SafeAreaView testID="check-result-loading" className="flex-1 gap-4 bg-surface-page dark:bg-surface-page-dark px-4 pt-4">
        <Skeleton lines={5} />
      </SafeAreaView>
    );
  }

  const isFallback = data.status === "FALLBACK" || data.result === undefined;
  const result = data.result ?? SAFE_FALLBACK;
  const hasRedFlag = data.redFlag !== undefined;
  const display = URGENCY_DISPLAY[result.urgency];
  const tierLabel = strings.check.result.tierLabel[result.urgency];
  const disclaimerLine = strings.check.result.disclaimer(APP_DISPLAY_NAME);

  function handleFindVet(urgency: Urgency) {
    void Linking.openURL(buildVetSearchUrl(urgency));
  }

  function handleShare() {
    void Share.share({ message: buildSharePayload({ tierLabel, result, disclaimerLine }) });
  }

  function handleDone() {
    router.replace("/(tabs)/timeline");
    // T109 (plan §2.6.1 structural safety argument, `use-paywall-trigger.ts`
    // style): this call is placed AFTER navigating away from the `check`
    // segment, fires only on the user's own explicit Done tap, and is
    // gated on a non-fallback, non-red-flag, REASSURE-tier result -- so no
    // §7 flow (intake, waiting, emergency interstitial, safe fallback) can
    // ever have a review dialog interposed on it.
    if (!isFallback && !hasRedFlag && result.urgency === "REASSURE") {
      void maybeRequestReview("reassure-acknowledged");
    }
  }

  function handleEmergencyCta() {
    router.push({ pathname: "/check/emergency/[checkId]", params: { checkId: checkId ?? "" } });
  }

  return (
    <SafeAreaView testID="check-result-screen" className="flex-1 bg-surface-page dark:bg-surface-page-dark">
      <AppHeader onBack={onBack} />
      <ScrollView testID="check-result-scroll" className="flex-1">
        <View className={contentClassName}>
          {data.redFlag !== undefined ? (
            <View testID="check-result-emergency-notice" className="gap-2 rounded-2xl bg-red-600 px-4 py-3">
              <Text className="text-center text-lg font-semibold text-white">
                {strings.check.result.emergencyNoticeTitle}
              </Text>
              <Text className="text-center text-sm text-white">{strings.check.result.emergencyNoticeBody}</Text>
              <PrimaryButton
                testID="check-result-emergency-cta"
                label={strings.check.result.emergencyNoticeCta}
                onPress={handleEmergencyCta}
              />
            </View>
          ) : null}

          {isFallback ? (
            <View testID="check-result-fallback-notice" className="rounded-2xl bg-amber-100 px-4 py-3">
              <Text className="text-center text-sm text-amber-950">{strings.check.result.fallbackNotice}</Text>
            </View>
          ) : null}

          <View testID="check-result-urgency-banner">
            <View
              testID={display.testId}
              className={`items-center rounded-2xl px-4 py-3 ${display.containerClass}`}
            >
              <Text className={`text-center text-lg font-bold ${display.textClass}`}>{tierLabel}</Text>
            </View>
          </View>

          <Card className="gap-4">
            <Text testID="check-result-summary" className="text-base text-brand-900 dark:text-ink-dark font-body">
              {result.summary}
            </Text>

            {result.possibleCauses.length ? (
              <View testID="check-result-possible-causes" className="gap-2">
                <Text
                  accessibilityRole="header"
                  className="text-lg font-semibold text-brand-900 dark:text-ink-dark font-display-semibold"
                >
                  {strings.check.result.sections.possibleCauses}
                </Text>
                {result.possibleCauses.map((cause) => (
                  <View key={cause.name}>
                    <Text className="text-base font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">{cause.name}</Text>
                    <Text className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">{cause.whyItFits}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {result.redFlagsToWatch.length ? (
              <View testID="check-result-red-flags-to-watch" className="gap-2">
                <Text
                  accessibilityRole="header"
                  className="text-lg font-semibold text-brand-900 dark:text-ink-dark font-display-semibold"
                >
                  {strings.check.result.sections.redFlagsToWatch}
                </Text>
                {result.redFlagsToWatch.map((item) => (
                  <Text key={item} className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">
                    {`• ${item}`}
                  </Text>
                ))}
              </View>
            ) : null}

            {result.homeCare.length ? (
              <View testID="check-result-home-care" className="gap-2">
                <Text
                  accessibilityRole="header"
                  className="text-lg font-semibold text-brand-900 dark:text-ink-dark font-display-semibold"
                >
                  {strings.check.result.sections.homeCare}
                </Text>
                {result.homeCare.map((item) => (
                  <Text key={item} className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">
                    {`• ${item}`}
                  </Text>
                ))}
              </View>
            ) : null}

            {result.doNot.length ? (
              <View testID="check-result-do-not" className="gap-2">
                <Text
                  accessibilityRole="header"
                  className="text-lg font-semibold text-brand-900 dark:text-ink-dark font-display-semibold"
                >
                  {strings.check.result.sections.doNot}
                </Text>
                {result.doNot.map((item) => (
                  <Text key={item} className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">
                    {`• ${item}`}
                  </Text>
                ))}
              </View>
            ) : null}

            {result.vetQuestions.length ? (
              <View testID="check-result-vet-questions" className="gap-2">
                <Text
                  accessibilityRole="header"
                  className="text-lg font-semibold text-brand-900 dark:text-ink-dark font-display-semibold"
                >
                  {strings.check.result.sections.vetQuestions}
                </Text>
                {result.vetQuestions.map((item) => (
                  <Text key={item} className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">
                    {`• ${item}`}
                  </Text>
                ))}
              </View>
            ) : null}
          </Card>

          <VetDisclaimer />

          <View className="gap-2">
            <PrimaryButton
              testID="check-result-find-vet"
              label={strings.check.result.findVet}
              onPress={() => handleFindVet(result.urgency)}
            />
            <SecondaryButton testID="check-result-share" label={strings.check.result.share} onPress={handleShare} />
            <GhostButton testID="check-result-done" label={strings.check.result.done} onPress={handleDone} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
