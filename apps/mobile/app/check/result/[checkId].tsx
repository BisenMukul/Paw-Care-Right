import { APP_DISPLAY_NAME } from "@pawcareright/config";
import { isTerminalCheckStatus, SAFE_FALLBACK, type Urgency } from "@pawcareright/types";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCheck } from "../../../src/api/checks-api";
import { buildSharePayload } from "../../../src/checks/share-payload";
import { URGENCY_DISPLAY } from "../../../src/checks/urgency-display";
import { buildVetSearchUrl } from "../../../src/checks/vet-search";
import { PrimaryButton } from "../../../src/components/primary-button";
import { VetDisclaimer } from "../../../src/components/vet-disclaimer";
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
  const { checkId } = useLocalSearchParams<{ checkId?: string }>();
  const { data, isError, refetch } = useCheck(checkId ?? "");

  if (isError && !data) {
    return (
      <SafeAreaView
        testID="check-result-error"
        className="flex-1 items-center justify-center gap-4 bg-white px-6"
      >
        <Text className="text-center text-base text-red-600">{strings.check.result.error}</Text>
        <Text className="text-center text-sm text-brand-700">{strings.check.result.errorHint}</Text>
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
      <SafeAreaView
        testID="check-result-loading"
        className="flex-1 items-center justify-center gap-4 bg-white px-6"
      >
        <ActivityIndicator testID="check-result-loading-spinner" />
        <Text className="text-center text-base text-brand-900">{strings.check.result.loading}</Text>
      </SafeAreaView>
    );
  }

  const isFallback = data.status === "FALLBACK" || data.result === undefined;
  const result = data.result ?? SAFE_FALLBACK;
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
  }

  function handleEmergencyCta() {
    router.push({ pathname: "/check/emergency/[checkId]", params: { checkId: checkId ?? "" } });
  }

  return (
    <SafeAreaView testID="check-result-screen" className="flex-1 bg-white">
      <ScrollView testID="check-result-scroll" className="flex-1">
        <View className="gap-4 px-6 pb-8 pt-4">
          {data.redFlag !== undefined ? (
            <View testID="check-result-emergency-notice" className="gap-2 rounded-lg bg-red-600 px-4 py-3">
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
            <View testID="check-result-fallback-notice" className="rounded-lg bg-amber-100 px-4 py-3">
              <Text className="text-center text-sm text-amber-950">{strings.check.result.fallbackNotice}</Text>
            </View>
          ) : null}

          <View testID="check-result-urgency-banner">
            <View
              testID={display.testId}
              className={`items-center rounded-lg px-4 py-3 ${display.containerClass}`}
            >
              <Text className={`text-center text-lg font-semibold ${display.textClass}`}>{tierLabel}</Text>
            </View>
          </View>

          <Text testID="check-result-summary" className="text-base text-brand-900">
            {result.summary}
          </Text>

          {result.possibleCauses.length ? (
            <View testID="check-result-possible-causes" className="gap-2">
              <Text className="text-lg font-semibold text-brand-900">
                {strings.check.result.sections.possibleCauses}
              </Text>
              {result.possibleCauses.map((cause) => (
                <View key={cause.name}>
                  <Text className="text-base font-semibold text-brand-900">{cause.name}</Text>
                  <Text className="text-sm text-brand-700">{cause.whyItFits}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {result.redFlagsToWatch.length ? (
            <View testID="check-result-red-flags-to-watch" className="gap-2">
              <Text className="text-lg font-semibold text-brand-900">
                {strings.check.result.sections.redFlagsToWatch}
              </Text>
              {result.redFlagsToWatch.map((item) => (
                <Text key={item} className="text-sm text-brand-700">
                  {`• ${item}`}
                </Text>
              ))}
            </View>
          ) : null}

          {result.homeCare.length ? (
            <View testID="check-result-home-care" className="gap-2">
              <Text className="text-lg font-semibold text-brand-900">{strings.check.result.sections.homeCare}</Text>
              {result.homeCare.map((item) => (
                <Text key={item} className="text-sm text-brand-700">
                  {`• ${item}`}
                </Text>
              ))}
            </View>
          ) : null}

          {result.doNot.length ? (
            <View testID="check-result-do-not" className="gap-2">
              <Text className="text-lg font-semibold text-brand-900">{strings.check.result.sections.doNot}</Text>
              {result.doNot.map((item) => (
                <Text key={item} className="text-sm text-brand-700">
                  {`• ${item}`}
                </Text>
              ))}
            </View>
          ) : null}

          {result.vetQuestions.length ? (
            <View testID="check-result-vet-questions" className="gap-2">
              <Text className="text-lg font-semibold text-brand-900">
                {strings.check.result.sections.vetQuestions}
              </Text>
              {result.vetQuestions.map((item) => (
                <Text key={item} className="text-sm text-brand-700">
                  {`• ${item}`}
                </Text>
              ))}
            </View>
          ) : null}

          <VetDisclaimer />

          <View className="gap-2">
            <PrimaryButton
              testID="check-result-find-vet"
              label={strings.check.result.findVet}
              onPress={() => handleFindVet(result.urgency)}
            />
            <PrimaryButton testID="check-result-share" label={strings.check.result.share} onPress={handleShare} />
            <PrimaryButton testID="check-result-done" label={strings.check.result.done} onPress={handleDone} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
