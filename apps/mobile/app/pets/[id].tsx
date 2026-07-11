import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePet } from "../../src/api/pets-api";
import { PrimaryButton } from "../../src/components/primary-button";
import { strings } from "../../src/strings";

/**
 * Deliberately minimal pet home (plan R4): name/species/breed + a local
 * photo preview (from the just-finished wizard) or a placeholder. No
 * remote photo fetch — no display-URL endpoint exists yet.
 */
export default function PetHomeScreen() {
  const router = useRouter();
  const { id, localPhoto } = useLocalSearchParams<{ id: string; localPhoto?: string }>();
  const { data: pet, isLoading, isError } = usePet(id);

  return (
    <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
      {isLoading ? (
        <>
          <ActivityIndicator testID="pet-home-loading" />
          <Text className="text-center text-base text-brand-900">{strings.petHome.loading}</Text>
        </>
      ) : isError ? (
        <Text testID="pet-home-error" className="text-center text-base text-red-600">
          {strings.petHome.error}
        </Text>
      ) : !pet ? (
        <Text testID="pet-home-empty" className="text-center text-base text-brand-900">
          {strings.petHome.empty}
        </Text>
      ) : (
        <>
          {localPhoto ? (
            <Image
              testID="pet-home-photo"
              source={{ uri: localPhoto }}
              className="h-32 w-32 rounded-full"
            />
          ) : (
            <View testID="pet-home-photo-placeholder" className="h-32 w-32 rounded-full bg-brand-100" />
          )}
          <Text testID="pet-home-name" className="text-xl font-semibold text-brand-900">
            {pet.name}
          </Text>
          <Text className="text-base text-brand-900">{pet.species}</Text>
          {pet.breedSlug ? <Text className="text-base text-brand-900">{pet.breedSlug}</Text> : null}
        </>
      )}
      <PrimaryButton
        testID="pet-home-done"
        label={strings.petHome.done}
        onPress={() => router.replace("/(tabs)")}
      />
    </SafeAreaView>
  );
}
