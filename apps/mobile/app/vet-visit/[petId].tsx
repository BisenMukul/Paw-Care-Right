import { useIsOffline } from "@pawcareright/api-client";
import type { VetVisitValue } from "@pawcareright/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAddVetVisit } from "../../src/api/health-logs-api";
import { usePet } from "../../src/api/pets-api";
import { AddVetVisitForm, type AddVetVisitFormHandle } from "../../src/components/add-vet-visit-form";
import { PrimaryButton } from "../../src/components/primary-button";
import { SaveConfirmation } from "../../src/components/save-confirmation";
import { ScreenScaffold } from "../../src/components/screen-scaffold";
import { Skeleton } from "../../src/components/skeleton";
import { strings } from "../../src/strings";

/** Design-system §7.5 Peak-End: how long the confirmation banner shows before the existing `router.back()` fires (only navigation is deferred — the mutation itself is un-delayed). */
const CONFIRM_MS = 1200;

/**
 * "Vet visit" quick-action screen (T066 plan): same skeleton as
 * `app/note/[petId].tsx` — the form IS the screen body (tap 1 = navigate
 * here, tap 2 = Save). No cost/med/dose field (decision 5 / CLAUDE §7); no
 * AI output, touches no disclaimer/emergency surface.
 *
 * CRAFT-1 §7.4/§7.5: the save button is bottom-pinned via `ScreenScaffold`'s
 * `footer` (the form is a `forwardRef` field-group exposing `submit()`), and
 * a successful save shows a `SaveConfirmation` banner while `router.back()`
 * is deferred by `CONFIRM_MS` (R1 -- the mutation itself fires and completes
 * un-delayed; only the navigation waits so the banner is briefly visible).
 */
export default function VetVisitScreen() {
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const { data: pet, isLoading, isError, refetch } = usePet(petId);
  const addVetVisit = useAddVetVisit(petId);
  const isOffline = useIsOffline();
  const router = useRouter();
  const formRef = useRef<AddVetVisitFormHandle>(null);
  const backTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    return () => {
      if (backTimerRef.current !== null) {
        clearTimeout(backTimerRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-brand-50 px-6">
        <Skeleton lines={5} testID="vet-visit-screen-loading" />
      </SafeAreaView>
    );
  }

  if (isOffline && !pet) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-brand-50 px-6">
        <Text testID="vet-visit-screen-offline" className="text-center text-base text-brand-900">
          {strings.vetVisit.offline}
        </Text>
        <PrimaryButton testID="vet-visit-screen-retry" label={strings.vetVisit.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-brand-50 px-6">
        <Text testID="vet-visit-screen-error" className="text-center text-base text-red-700">
          {strings.vetVisit.error}
        </Text>
        <PrimaryButton testID="vet-visit-screen-retry" label={strings.vetVisit.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (!pet) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-brand-50 px-6">
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
        onSuccess: () => {
          setSaved(true);
          backTimerRef.current = setTimeout(() => {
            backTimerRef.current = null;
            router.back();
          }, CONFIRM_MS);
        },
      },
    );
  }

  return (
    <ScreenScaffold
      title={strings.vetVisit.title}
      footer={
        <PrimaryButton
          testID="add-vet-visit-save"
          label={strings.vetVisit.save}
          loading={addVetVisit.isPending}
          disabled={saved}
          onPress={() => formRef.current?.submit()}
        />
      }
    >
      {saved ? (
        <SaveConfirmation
          testID="vet-visit-saved-confirmation"
          message={strings.vetVisit.savedConfirmation}
          nudge={strings.vetVisit.savedNudge}
        />
      ) : null}
      {isOffline ? (
        <Text testID="vet-visit-screen-offline-banner" className="text-center text-sm text-brand-700">
          {strings.vetVisit.offlineBanner}
        </Text>
      ) : null}
      <AddVetVisitForm ref={formRef} petId={petId} submitting={addVetVisit.isPending} onSubmit={handleSubmit} />
    </ScreenScaffold>
  );
}
