import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text } from "react-native";
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
    router.replace({ pathname: "/pets/[id]", params: { id: petId, localPhoto: localPhoto ?? "" } });
  }

  // Run once on mount; `run` re-reads the latest draft/store state on every
  // invocation (including from the Retry button below), so an empty
  // dependency array here is intentional (mirrors the root layout's
  // mount-only `restore()` effect).
  useEffect(() => {
    void run();
  }, []);

  return (
    <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
      {error !== null ? (
        <>
          <Text testID="add-pet-error" className="text-center text-base text-red-600">
            {error}
          </Text>
          <PrimaryButton testID="add-pet-retry" label={strings.addPet.done.retry} onPress={run} />
        </>
      ) : (
        <>
          <ActivityIndicator testID="add-pet-submitting" />
          <Text className="text-center text-base text-brand-900">
            {strings.addPet.done.submitting}
          </Text>
        </>
      )}
    </SafeAreaView>
  );
}
