import { resolveEmergencyPayload, resolveRegionHotline } from "@pawcareright/data";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { BackHandler, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCheck } from "../../../src/api/checks-api";
import { getDeviceRegionCode } from "../../../src/checks/region";
import { buildVetSearchUrl } from "../../../src/checks/vet-search";
import { PrimaryButton } from "../../../src/components/primary-button";
import { strings } from "../../../src/strings";

/**
 * The T047/T048 contract route: `/check/emergency/[checkId]`. A full-screen,
 * un-dismissable takeover for red-flag hits (T049 plan "Screen spec"). Reads
 * ONLY the check's `redFlag.payloadKey` and renders static emergency content
 * + a region-aware poison hotline — it renders NO AI `result` fields, even
 * when the check has one (§5 rule 4 / §7 rule 4). `resolveEmergencyPayload`
 * fails upward to a generic go-now emergency payload when the key is
 * missing/unknown or the check hasn't loaded yet (§5 rule 2). The ONLY
 * forward navigation is the explicit acknowledge button: Android hardware
 * back is blocked below, and the route disables iOS swipe-back via
 * `gestureEnabled: false` in `app/_layout.tsx`.
 */
export default function EmergencyInterstitialScreen() {
  const router = useRouter();
  const { checkId } = useLocalSearchParams<{ checkId?: string }>();
  const { data } = useCheck(checkId ?? "");
  const payload = resolveEmergencyPayload(data?.redFlag?.payloadKey);
  const hotline = resolveRegionHotline(getDeviceRegionCode());

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);

  function handleAcknowledge() {
    router.replace({ pathname: "/check/result/[checkId]", params: { checkId: checkId ?? "" } });
  }

  function handleFindVet() {
    void Linking.openURL(buildVetSearchUrl("EMERGENCY_NOW"));
  }

  function handleCallHotline() {
    if (hotline.dialNumber) {
      void Linking.openURL(`tel:${hotline.dialNumber}`);
    }
  }

  return (
    <SafeAreaView testID="emergency-interstitial" className="flex-1 bg-red-700">
      <ScrollView className="flex-1">
        <View className="gap-4 px-6 pb-8 pt-4">
          <View testID="emergency-go-now-badge" className="items-center rounded-lg bg-red-900 px-4 py-2">
            <Text className="text-center text-base font-bold uppercase text-white">
              {strings.check.emergency.goNowBadge}
            </Text>
          </View>

          <Text testID="emergency-title" className="text-center text-2xl font-bold text-white">
            {payload.title}
          </Text>

          <View className="gap-2">
            <Text className="text-lg font-semibold text-white">{strings.check.emergency.detectedHeading}</Text>
            <Text testID="emergency-detected" className="text-base text-white">
              {payload.detected}
            </Text>
          </View>

          <View className="gap-2">
            <Text className="text-lg font-semibold text-white">{strings.check.emergency.guidanceHeading}</Text>
            <Text testID="emergency-guidance" className="text-base text-white">
              {payload.guidance}
            </Text>
          </View>

          <View testID="emergency-hotline" className="gap-2 rounded-lg bg-red-800 px-4 py-3">
            {hotline.known ? (
              <>
                <Text className="text-lg font-semibold text-white">{strings.check.emergency.hotlineHeading}</Text>
                <Text testID="emergency-hotline-name" className="text-base text-white">
                  {hotline.poisonHotlineName}
                </Text>
                <Text testID="emergency-hotline-number" className="text-base text-white">
                  {hotline.displayNumber}
                </Text>
                {hotline.feeNote ? (
                  <Text testID="emergency-hotline-fee" className="text-sm text-white">
                    {hotline.feeNote}
                  </Text>
                ) : null}
                <PrimaryButton
                  testID="emergency-call-hotline"
                  label={strings.check.emergency.callHotline}
                  onPress={handleCallHotline}
                />
              </>
            ) : (
              <Text testID="emergency-hotline-fallback" className="text-base text-white">
                {strings.check.emergency.hotlineFallback}
              </Text>
            )}
          </View>

          <View className="gap-2">
            <PrimaryButton
              testID="emergency-find-vet"
              label={strings.check.emergency.findVet}
              onPress={handleFindVet}
            />
            <PrimaryButton
              testID="emergency-acknowledge"
              label={strings.check.emergency.acknowledge}
              onPress={handleAcknowledge}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
