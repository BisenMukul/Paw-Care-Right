import { useIsOffline } from "@pawcareright/api-client";
import type { VetVisitValue } from "@pawcareright/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAddVetVisit } from "../../src/api/health-logs-api";
import { usePet } from "../../src/api/pets-api";
import { AddVetVisitForm } from "../../src/components/add-vet-visit-form";
import { PrimaryButton } from "../../src/components/primary-button";
import { strings } from "../../src/strings";

/**
 * "Vet visit" quick-action screen (T066 plan): same skeleton as
 * `app/note/[petId].tsx` — the form IS the screen body (tap 1 = navigate
 * here, tap 2 = Save). No cost/med/dose field (decision 5 / CLAUDE §7); no
 * AI output, touches no disclaimer/emergency surface.
 */
export default function VetVisitScreen() {
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const { data: pet, isLoading, isError, refetch } = usePet(petId);
  const addVetVisit = useAddVetVisit(petId);
  const isOffline = useIsOffline();
  const router = useRouter();

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <ActivityIndicator testID="vet-visit-screen-loading" />
        <Text className="text-center text-base text-brand-900">{strings.vetVisit.loading}</Text>
      </SafeAreaView>
    );
  }

  if (isOffline && !pet) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <Text testID="vet-visit-screen-offline" className="text-center text-base text-brand-900">
          {strings.vetVisit.offline}
        </Text>
        <PrimaryButton testID="vet-visit-screen-retry" label={strings.vetVisit.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <Text testID="vet-visit-screen-error" className="text-center text-base text-red-600">
          {strings.vetVisit.error}
        </Text>
        <PrimaryButton testID="vet-visit-screen-retry" label={strings.vetVisit.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (!pet) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <Text testID="vet-visit-screen-empty" className="text-center text-base text-brand-900">
          {strings.vetVisit.empty}
        </Text>
      </SafeAreaView>
    );
  }

  function handleSubmit(value: VetVisitValue, photoKeys: string[]) {
    addVetVisit.mutate(
      { value, photoKeys },
      {
        onSuccess: () => router.back(),
      },
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {isOffline ? (
        <Text testID="vet-visit-screen-offline-banner" className="px-6 pt-2 text-center text-sm text-brand-700">
          {strings.vetVisit.offlineBanner}
        </Text>
      ) : null}
      <View className="px-6 pt-4">
        <Text className="text-xl font-semibold text-brand-900">{strings.vetVisit.title}</Text>
      </View>
      <AddVetVisitForm petId={petId} submitting={addVetVisit.isPending} onSubmit={handleSubmit} />
    </SafeAreaView>
  );
}
