import { useIsOffline } from "@pawcareright/api-client";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAddWeight, useWeightSeries } from "../../src/api/health-logs-api";
import { usePet } from "../../src/api/pets-api";
import { AddWeightForm } from "../../src/components/add-weight-form";
import { PrimaryButton } from "../../src/components/primary-button";
import { ScreenScaffold } from "../../src/components/screen-scaffold";
import { Skeleton } from "../../src/components/skeleton";
import { WeightChart } from "../../src/components/weight-chart";
import { strings } from "../../src/strings";
import { resolveBreedBand } from "../../src/weight/breed-weight-band";
import { useWeightUnit } from "../../src/weight/weight-unit-store";

/**
 * Weight chart screen (T065 plan): the "Log weight" quick-action's entry
 * point. Gates on the pet resource exactly like `app/pets/[id].tsx`
 * (loading / error / not-found / offline), then composes the presentational
 * `<WeightChart/>` over the pet's weight series plus an optional breed
 * typical-range band. No AI output, no diagnosis/dosing copy; this screen
 * touches no disclaimer/emergency surface (CLAUDE §7 unaffected).
 */
export default function WeightScreen() {
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const { data: pet, isLoading, isError, refetch } = usePet(petId);
  const { data: series } = useWeightSeries(petId);
  const { unit, toggle } = useWeightUnit();
  const addWeight = useAddWeight(petId);
  const isOffline = useIsOffline();
  const [formVisible, setFormVisible] = useState(false);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-brand-50 px-6">
        <Skeleton lines={4} testID="weight-screen-loading" />
      </SafeAreaView>
    );
  }

  if (isOffline && !pet) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-brand-50 px-6">
        <Text testID="weight-screen-offline" className="text-center text-base text-brand-900">
          {strings.weight.offline}
        </Text>
        <PrimaryButton testID="weight-screen-retry" label={strings.weight.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-brand-50 px-6">
        <Text testID="weight-screen-error" className="text-center text-base text-red-700">
          {strings.weight.error}
        </Text>
        <PrimaryButton testID="weight-screen-retry" label={strings.weight.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (!pet) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-brand-50 px-6">
        <Text testID="weight-screen-empty" className="text-center text-base text-brand-900">
          {strings.weight.empty}
        </Text>
      </SafeAreaView>
    );
  }

  const band = resolveBreedBand(pet.species, pet.breedSlug);
  const points = (series?.points ?? []).map((point) => ({ t: Date.parse(point.t), grams: point.grams }));

  function handleSubmit(grams: number) {
    addWeight.mutate(
      { grams },
      {
        onSuccess: () => setFormVisible(false),
      },
    );
  }

  return (
    <>
      <ScreenScaffold title={strings.weight.title}>
        {isOffline ? (
          <Text testID="weight-screen-offline-banner" className="text-center text-sm text-brand-700">
            {strings.weight.offlineBanner}
          </Text>
        ) : null}
        <Pressable
          testID="weight-unit-toggle"
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={strings.weight.unitToggleA11y}
          className="min-h-[44px] justify-center self-start rounded-full bg-brand-100 px-4 py-2"
        >
          <Text className="text-base font-medium text-brand-900">{strings.weight.unitLabel[unit]}</Text>
        </Pressable>
        <WeightChart points={points} band={band} unit={unit} />
        <PrimaryButton
          testID="weight-add-button"
          label={strings.weight.addWeight}
          onPress={() => setFormVisible(true)}
        />
      </ScreenScaffold>
      <AddWeightForm
        visible={formVisible}
        unit={unit}
        submitting={addWeight.isPending}
        onSubmit={handleSubmit}
        onClose={() => setFormVisible(false)}
      />
    </>
  );
}
