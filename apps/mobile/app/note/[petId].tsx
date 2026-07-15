import { useIsOffline } from "@pawcareright/api-client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAddNote } from "../../src/api/health-logs-api";
import { usePet } from "../../src/api/pets-api";
import { AddNoteForm } from "../../src/components/add-note-form";
import { PrimaryButton } from "../../src/components/primary-button";
import { strings } from "../../src/strings";

/**
 * "Log note" quick-action screen (T066 plan): tap 1 (pet home) navigates
 * straight here — the form IS the screen body, no intermediate "add"
 * button. Tap 2 = Save. Gates on `usePet` for the mandated loading/error/
 * empty/offline states (§6), mirroring `app/weight/[petId].tsx` exactly.
 * No AI output, no diagnosis/dosing copy; touches no disclaimer/emergency
 * surface (CLAUDE §7 unaffected).
 */
export default function NoteScreen() {
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const { data: pet, isLoading, isError, refetch } = usePet(petId);
  const addNote = useAddNote(petId);
  const isOffline = useIsOffline();
  const router = useRouter();

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <ActivityIndicator testID="note-screen-loading" />
        <Text className="text-center text-base text-brand-900">{strings.note.loading}</Text>
      </SafeAreaView>
    );
  }

  if (isOffline && !pet) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <Text testID="note-screen-offline" className="text-center text-base text-brand-900">
          {strings.note.offline}
        </Text>
        <PrimaryButton testID="note-screen-retry" label={strings.note.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <Text testID="note-screen-error" className="text-center text-base text-red-600">
          {strings.note.error}
        </Text>
        <PrimaryButton testID="note-screen-retry" label={strings.note.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (!pet) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <Text testID="note-screen-empty" className="text-center text-base text-brand-900">
          {strings.note.empty}
        </Text>
      </SafeAreaView>
    );
  }

  function handleSubmit(input: { text: string; photoKeys: string[] }) {
    addNote.mutate(input, {
      onSuccess: () => router.back(),
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {isOffline ? (
        <Text testID="note-screen-offline-banner" className="px-6 pt-2 text-center text-sm text-brand-700">
          {strings.note.offlineBanner}
        </Text>
      ) : null}
      <View className="px-6 pt-4">
        <Text className="text-xl font-semibold text-brand-900">{strings.note.title}</Text>
      </View>
      <AddNoteForm petId={petId} submitting={addNote.isPending} onSubmit={handleSubmit} />
    </SafeAreaView>
  );
}
