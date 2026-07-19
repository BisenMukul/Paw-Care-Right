import { useIsOffline } from "@pawcareright/api-client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAddNote } from "../../src/api/health-logs-api";
import { usePet } from "../../src/api/pets-api";
import { AddNoteForm, type AddNoteFormHandle } from "../../src/components/add-note-form";
import { PrimaryButton } from "../../src/components/primary-button";
import { SaveConfirmation } from "../../src/components/save-confirmation";
import { ScreenScaffold } from "../../src/components/screen-scaffold";
import { Skeleton } from "../../src/components/skeleton";
import { strings } from "../../src/strings";

/** Design-system §7.5 Peak-End: how long the confirmation banner shows before the existing `router.back()` fires (only navigation is deferred — the mutation itself is un-delayed). */
const CONFIRM_MS = 1200;

/**
 * "Log note" quick-action screen (T066 plan): tap 1 (pet home) navigates
 * straight here — the form IS the screen body, no intermediate "add"
 * button. Tap 2 = Save. Gates on `usePet` for the mandated loading/error/
 * empty/offline states (§6), mirroring `app/weight/[petId].tsx` exactly.
 * No AI output, no diagnosis/dosing copy; touches no disclaimer/emergency
 * surface (CLAUDE §7 unaffected).
 *
 * CRAFT-1 §7.4/§7.5: the save button is bottom-pinned via `ScreenScaffold`'s
 * `footer` (the form is a `forwardRef` field-group exposing `submit()`), and
 * a successful save shows a `SaveConfirmation` banner while `router.back()`
 * is deferred by `CONFIRM_MS` (R1 -- the mutation itself fires and completes
 * un-delayed; only the navigation waits so the banner is briefly visible).
 */
export default function NoteScreen() {
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const { data: pet, isLoading, isError, refetch } = usePet(petId);
  const addNote = useAddNote(petId);
  const isOffline = useIsOffline();
  const router = useRouter();
  const formRef = useRef<AddNoteFormHandle>(null);
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
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-surface-page dark:bg-surface-page-dark px-6">
        <Skeleton lines={4} testID="note-screen-loading" />
      </SafeAreaView>
    );
  }

  if (isOffline && !pet) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-surface-page dark:bg-surface-page-dark px-6">
        <Text testID="note-screen-offline" className="text-center text-base text-brand-900 dark:text-ink-dark font-body">
          {strings.note.offline}
        </Text>
        <PrimaryButton testID="note-screen-retry" label={strings.note.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-surface-page dark:bg-surface-page-dark px-6">
        <Text testID="note-screen-error" className="text-center text-base text-red-700 dark:text-red-400">
          {strings.note.error}
        </Text>
        <PrimaryButton testID="note-screen-retry" label={strings.note.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (!pet) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-surface-page dark:bg-surface-page-dark px-6">
        <Text testID="note-screen-empty" className="text-center text-base text-brand-900 dark:text-ink-dark font-body">
          {strings.note.empty}
        </Text>
      </SafeAreaView>
    );
  }

  function handleSubmit(input: { text: string; photoKeys: string[] }) {
    addNote.mutate(input, {
      onSuccess: () => {
        setSaved(true);
        backTimerRef.current = setTimeout(() => {
          backTimerRef.current = null;
          router.back();
        }, CONFIRM_MS);
      },
    });
  }

  return (
    <ScreenScaffold
      title={strings.note.title}
      footer={
        <PrimaryButton
          testID="add-note-save"
          label={strings.note.save}
          loading={addNote.isPending}
          disabled={saved}
          onPress={() => formRef.current?.submit()}
        />
      }
    >
      {saved ? (
        <SaveConfirmation
          testID="note-saved-confirmation"
          message={strings.note.savedConfirmation}
          nudge={strings.note.savedNudge}
        />
      ) : null}
      {isOffline ? (
        <Text testID="note-screen-offline-banner" className="text-center text-sm text-brand-700 dark:text-ink-muted-dark font-body">
          {strings.note.offlineBanner}
        </Text>
      ) : null}
      <AddNoteForm ref={formRef} petId={petId} submitting={addNote.isPending} onSubmit={handleSubmit} />
    </ScreenScaffold>
  );
}
