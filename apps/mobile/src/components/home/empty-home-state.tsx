import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { strings } from "../../strings";
import { PrimaryButton } from "../primary-button";

/**
 * No-pet hero for the home tab (founder UI overhaul): a big paw icon,
 * welcome copy, and the add-pet CTA. `testID` stays `home-add-pet-cta` --
 * the C2 checklist + older tests reference it.
 */
export function EmptyHomeState() {
  const router = useRouter();

  return (
    <View testID="home-empty-state" className="items-center gap-4 rounded-2xl bg-white px-6 py-10">
      <Ionicons name="paw-outline" size={64} color="#2f8f74" />
      <Text className="text-center text-xl font-semibold text-brand-900">{strings.home.welcomeTitle}</Text>
      <Text className="text-center text-base text-brand-700">{strings.home.welcomeBody}</Text>
      <PrimaryButton
        testID="home-add-pet-cta"
        label={strings.addPet.homeCta}
        onPress={() => router.push("/add-pet/species")}
      />
    </View>
  );
}
