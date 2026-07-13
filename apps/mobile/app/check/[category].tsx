import { useIsOffline } from "@pawcareright/api-client";
import { getCategoryDef, type CompletedIntake } from "@pawcareright/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { uploadIntakePhoto } from "../../src/api/intake-photos-api";
import { IntakeForm } from "../../src/components/intake/intake-form";
import { strings } from "../../src/strings";

/**
 * Dynamic symptom-intake route (T045 plan): reads `{ category, petId }`,
 * looks up the schema-driven `CategoryDef`, and renders `IntakeForm`. This
 * screen owns `petId` (a T042 path param, NOT part of `CompletedIntake`)
 * and supplies a T045 stub `onSubmit` — T047 replaces the stub with the
 * real submit mutation + red-flag/polling branch (plan "T047 handoff
 * contract"). Collection UI only: no AI output, no triage, no emergency
 * interstitial on this screen (CLAUDE.md §7 unaffected).
 */
export default function IntakeScreen() {
  const router = useRouter();
  const { category, petId } = useLocalSearchParams<{ category?: string; petId?: string }>();
  const isOffline = useIsOffline();

  const categoryDef = category !== undefined ? getCategoryDef(category) : undefined;

  // T046: the pet-scoped upload capability, built from this route's own
  // `petId` param — the schema-driven `IntakeForm`/`QuestionRenderer` never
  // learn `petId` themselves (plan §"petId / capability seam design").
  const photoUpload = useMemo(
    () =>
      petId !== undefined
        ? { upload: (uri: string, onProgress: (progress: number) => void) => uploadIntakePhoto(petId, uri, onProgress) }
        : undefined,
    [petId],
  );

  if (categoryDef === undefined) {
    return (
      <SafeAreaView testID="intake-invalid-category" className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-center text-base text-brand-900">{strings.intake.invalidCategory}</Text>
      </SafeAreaView>
    );
  }

  function handleSubmit(intake: CompletedIntake) {
    // TODO(T047): submit { petId, intake } + branch to red-flag/polling
    void petId;
    void intake;
  }

  return (
    <View className="flex-1 bg-white">
      {isOffline ? (
        <Text testID="intake-offline-banner" className="px-6 pt-2 text-center text-sm text-brand-700">
          {strings.intake.offlineBanner}
        </Text>
      ) : null}
      <IntakeForm
        categoryDef={categoryDef}
        onExit={() => router.back()}
        onSubmit={handleSubmit}
        photoUpload={photoUpload}
      />
    </View>
  );
}
