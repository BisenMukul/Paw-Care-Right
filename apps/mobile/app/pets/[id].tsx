import { isApiError, useIsOffline } from "@pawcareright/api-client";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePet } from "../../src/api/pets-api";
import { AnimatedGradientBackground } from "../../src/components/home/animated-gradient-background";
import { PetHeaderCard } from "../../src/components/pet-header-card";
import { PrimaryButton } from "../../src/components/primary-button";
import { QuickActions } from "../../src/components/quick-actions";
import { CTA_HEIGHT } from "../../src/pets/pet-home-layout";
import { strings } from "../../src/strings";

/**
 * Pet home (T025 plan, restyled by the founder UI/UX pass): an animated
 * gradient background (the SAME `AnimatedGradientBackground` the home tab
 * uses — no duplicated fallback logic), a hero header card, a pinned,
 * above-the-fold "Something wrong?" CTA, and a quick-actions grid. No AI
 * output, no diagnosis, no dosing; this screen touches no
 * disclaimer/emergency surface (CLAUDE.md §7 unaffected).
 *
 * The header region (offline banner + header card + CTA) is rendered
 * OUTSIDE and BEFORE the `pet-home-scroll` ScrollView so the CTA can never
 * be scrolled off the top (plan §AC2a).
 *
 * The Reminders quick action routes to the Care tab (`/(tabs)/care`, where
 * the agenda actually lives) — it no longer stubs to `/coming-soon`
 * (founder complaint fix).
 */
export default function PetHomeScreen() {
  const router = useRouter();
  const { id, localPhoto } = useLocalSearchParams<{ id: string; localPhoto?: string }>();
  const { data: pet, isLoading, isError, error, isFetching, refetch } = usePet(id);
  const isOffline = useIsOffline();

  // A network/transport failure (never reached the server, `httpStatus: 0`
  // — see `packages/api-client`'s `normalizeNetworkError`) reads as
  // "server unreachable"; every other `isError` case keeps the existing
  // generic copy (founder UI pass §2 error-copy split).
  const isServerUnreachable = isApiError(error) && error.httpStatus === 0;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <ActivityIndicator testID="pet-home-loading" />
        <Text className="text-center text-base text-brand-900">{strings.petHome.loading}</Text>
      </SafeAreaView>
    );
  }

  if (isOffline && !pet) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <Text testID="pet-home-offline" className="text-center text-base text-brand-900">
          {strings.petHome.offlineNoCache}
        </Text>
        <PrimaryButton
          testID="pet-home-retry"
          label={strings.petHome.retry}
          icon="refresh-outline"
          loading={isFetching}
          onPress={() => refetch()}
        />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <Text testID="pet-home-error" className="text-center text-base text-red-600">
          {isServerUnreachable ? strings.petHome.serverUnreachable : strings.petHome.error}
        </Text>
        <PrimaryButton
          testID="pet-home-retry"
          label={strings.petHome.retry}
          icon="refresh-outline"
          loading={isFetching}
          onPress={() => refetch()}
        />
      </SafeAreaView>
    );
  }

  if (!pet) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <Text testID="pet-home-empty" className="text-center text-base text-brand-900">
          {strings.petHome.empty}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1">
      <AnimatedGradientBackground />
      <SafeAreaView className="flex-1">
        <View testID="pet-home-header-region" className="gap-3 px-6 pb-4 pt-2">
          {isOffline ? (
            <Text testID="pet-home-offline-banner" className="text-center text-sm text-brand-700">
              {strings.petHome.offlineBanner}
            </Text>
          ) : null}
          <PetHeaderCard pet={pet} {...(localPhoto ? { localPhoto } : {})} />
          <Animated.View entering={FadeInDown.delay(80).duration(320)}>
            <Pressable
              testID="pet-home-cta"
              onPress={() => router.push({ pathname: "/check", params: { petId: id } })}
              accessibilityRole="button"
              style={({ pressed }) => [{ minHeight: CTA_HEIGHT }, pressed ? { opacity: 0.85 } : null]}
              className="flex-row items-center gap-4 rounded-2xl bg-brand-700 px-5 py-4 shadow-md"
            >
              <View className="h-12 w-12 items-center justify-center rounded-full bg-white/20">
                <Ionicons name="medkit" size={24} color="#ffffff" />
              </View>
              <View className="flex-1 gap-1">
                <Text className="text-lg font-semibold text-white">{strings.petHome.somethingWrong}</Text>
                <Text className="text-sm text-white/80">{strings.petHome.somethingWrongSubtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ffffff" />
            </Pressable>
          </Animated.View>
        </View>
        <ScrollView testID="pet-home-scroll" className="flex-1">
          <View className="gap-3 px-6 pb-8 pt-4">
            <Text className="text-base font-semibold text-brand-900">
              {strings.petHome.quickActionsTitle}
            </Text>
            <QuickActions
              onLogWeight={() => router.push({ pathname: "/weight/[petId]", params: { petId: id } })}
              onLogNote={() => router.push({ pathname: "/note/[petId]", params: { petId: id } })}
              onLogVetVisit={() => router.push({ pathname: "/vet-visit/[petId]", params: { petId: id } })}
              onReminders={() => router.push("/(tabs)/care")}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
