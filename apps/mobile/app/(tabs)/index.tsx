import { useRouter } from "expo-router";
import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppTitle } from "../../src/components/app-title";
import { PetSwitcher } from "../../src/components/pet-switcher";
import { PrimaryButton } from "../../src/components/primary-button";
import { useActivePet } from "../../src/pets/use-active-pet";
import { strings } from "../../src/strings";

export default function HomeScreen() {
  const router = useRouter();
  const { pet, isLoading } = useActivePet();

  return (
    <SafeAreaView className="flex-1 items-center justify-center gap-2 bg-white px-6">
      <AppTitle />
      <PetSwitcher />
      {pet ? (
        <PrimaryButton
          testID="home-open-active-pet"
          label={strings.home.openActivePet}
          onPress={() => router.push({ pathname: "/pets/[id]", params: { id: pet.id } })}
        />
      ) : (
        !isLoading && (
          <>
            <Text className="text-center text-base text-brand-900">{strings.home.body}</Text>
            <PrimaryButton
              testID="home-add-pet-cta"
              label={strings.addPet.homeCta}
              onPress={() => router.push("/add-pet/species")}
            />
          </>
        )
      )}
    </SafeAreaView>
  );
}
