import { useIsOffline } from "@pawcareright/api-client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePet } from "../../src/api/pets-api";
import { PetHeaderCard } from "../../src/components/pet-header-card";
import { PrimaryButton } from "../../src/components/primary-button";
import { QuickActions } from "../../src/components/quick-actions";
import { CTA_HEIGHT } from "../../src/pets/pet-home-layout";
import { strings } from "../../src/strings";

/**
 * Pet home (T025 plan): header card (photo, name, derived age, breed) plus
 * a pinned, above-the-fold "Something wrong?" CTA and a quick-actions row —
 * all three are inert stubs that route to the shared `coming-soon`
 * placeholder (plan R1). No AI output, no diagnosis, no dosing; this screen
 * touches no disclaimer/emergency surface (CLAUDE.md §7 unaffected).
 *
 * The header region (offline banner + header card + CTA) is rendered
 * OUTSIDE and BEFORE the `pet-home-scroll` ScrollView so the CTA can never
 * be scrolled off the top (plan §AC2a).
 */
export default function PetHomeScreen() {
  const router = useRouter();
  const { id, localPhoto } = useLocalSearchParams<{ id: string; localPhoto?: string }>();
  const { data: pet, isLoading, isError, refetch } = usePet(id);
  const isOffline = useIsOffline();

  const goToComingSoon = (feature: string) => {
    router.push({ pathname: "/coming-soon", params: { feature } });
  };

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
          {strings.petHome.offline}
        </Text>
        <PrimaryButton testID="pet-home-retry" label={strings.petHome.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <Text testID="pet-home-error" className="text-center text-base text-red-600">
          {strings.petHome.error}
        </Text>
        <PrimaryButton testID="pet-home-retry" label={strings.petHome.retry} onPress={() => refetch()} />
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
    <SafeAreaView className="flex-1 bg-white">
      <View testID="pet-home-header-region" className="gap-3 px-6 pb-4 pt-2">
        {isOffline ? (
          <Text testID="pet-home-offline-banner" className="text-center text-sm text-brand-700">
            {strings.petHome.offlineBanner}
          </Text>
        ) : null}
        <PetHeaderCard pet={pet} {...(localPhoto ? { localPhoto } : {})} />
        <Pressable
          testID="pet-home-cta"
          onPress={() => router.push({ pathname: "/check", params: { petId: id } })}
          accessibilityRole="button"
          style={{ minHeight: CTA_HEIGHT }}
          className="items-center justify-center rounded-lg bg-brand-700 px-6"
        >
          <Text className="text-base font-semibold text-white">{strings.petHome.somethingWrong}</Text>
        </Pressable>
      </View>
      <ScrollView testID="pet-home-scroll" className="flex-1">
        <View className="gap-4 px-6 pb-8 pt-4">
          <QuickActions
            onLogWeight={() => router.push({ pathname: "/weight/[petId]", params: { petId: id } })}
            onLogNote={() => router.push({ pathname: "/note/[petId]", params: { petId: id } })}
            onLogVetVisit={() => router.push({ pathname: "/vet-visit/[petId]", params: { petId: id } })}
            onReminders={() => goToComingSoon("reminders")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
