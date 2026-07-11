import { useRouter } from "expo-router";
import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppTitle } from "../../src/components/app-title";
import { PrimaryButton } from "../../src/components/primary-button";
import { strings } from "../../src/strings";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 items-center justify-center gap-2 bg-white px-6">
      <AppTitle />
      <Text className="text-center text-base text-brand-900">
        {strings.home.body}
      </Text>
      <PrimaryButton
        testID="home-add-pet-cta"
        label={strings.addPet.homeCta}
        onPress={() => router.push("/add-pet/species")}
      />
    </SafeAreaView>
  );
}
