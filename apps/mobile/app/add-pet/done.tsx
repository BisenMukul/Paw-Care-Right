import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { petsKeys, uploadPetPhoto, useCreatePet } from "../../src/api/pets-api";
import { PrimaryButton } from "../../src/components/primary-button";
import { buildCreatePetPayload, useAddPetStore } from "../../src/pets/add-pet-store";
import { strings } from "../../src/strings";

/**
 * Add-pet wizard step 5: submit + progress. Create is the atomic success
 * point (idempotent via `draft.createdPetId`, plan R3); a subsequent photo
 * upload failure is non-fatal and never blocks landing on pet home.
 */
export default function DoneScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const createPet = useCreatePet();
  const draft = useAddPetStore((state) => state.draft);
  const setCreatedPetId = useAddPetStore((state) => state.setCreatedPetId);
  const reset = useAddPetStore((state) => state.reset);
  const scheme = useColorScheme();
  const indicatorColor = scheme === "dark" ? "#2EA57C" : "#1f6350";

  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);

    let petId: string;
    try {
      if (draft.createdPetId !== null) {
        petId = draft.createdPetId;
      } else {
        const created = await createPet.mutateAsync(buildCreatePetPayload(draft));
        petId = created.id;
        setCreatedPetId(petId);
      }
    } catch {
      setError(strings.addPet.done.createError);
      return;
    }

    if (draft.photoUri !== null) {
      try {
        await uploadPetPhoto(petId, draft.photoUri);
      } catch {
        // Non-fatal: the pet exists; the photo can be retried later (R3).
      }
    }

    void queryClient.invalidateQueries({ queryKey: petsKeys.all });
    const localPhoto = draft.photoUri;
    reset();
    // T059 plan decision 4: the post-creation prompt is the care-plan
    // wizard, not pet home directly; the wizard's Confirm/Skip both forward
    // on to `/pets/[id]` with the same `localPhoto` handoff.
    router.replace({ pathname: "/care-plan/[petId]", params: { petId, localPhoto: localPhoto ?? "" } });
  }

  // Run once on mount; `run` re-reads the latest draft/store state on every
  // invocation (including from the Retry button below), so an empty
  // dependency array here is intentional (mirrors the root layout's
  // mount-only `restore()` effect).
  useEffect(() => {
    void run();
  }, []);

  return (
    <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-surface-page dark:bg-surface-page-dark px-6">
      {error !== null ? (
        <>
          <Text
            testID="add-pet-error"
            accessibilityRole="alert"
            className="text-center text-base text-red-700 dark:text-red-400"
          >
            {error}
          </Text>
          <PrimaryButton testID="add-pet-retry" label={strings.addPet.done.retry} onPress={run} />
        </>
      ) : (
        <>
          <ActivityIndicator testID="add-pet-submitting" color={indicatorColor} />
          <Text className="text-center text-base text-brand-900 dark:text-ink-dark font-body">
            {strings.addPet.done.submitting}
          </Text>
        </>
      )}
    </SafeAreaView>
  );
}
