import type { Pet } from "@pawcareright/types";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { strings } from "../../strings";

export interface PetHeroCardProps {
  pet: Pet;
  onPress: () => void;
}

const SPECIES_LABEL: Record<Pet["species"], string> = {
  DOG: strings.addPet.species.dog,
  CAT: strings.addPet.species.cat,
};

/**
 * Home tab hero card (founder UI overhaul): avatar, name, species/breed
 * line, and a chevron; the whole card is pressable -> pet home.
 *
 * The avatar is always a colored-initial circle -- there is no
 * `photoKey` -> URL resolver anywhere in this app yet (`PetSwitcher`'s
 * `PetAvatar` and `PetHeaderCard`'s photo prop are the only two existing
 * pet-photo displays, and neither resolves a stored `photoKey`; the latter
 * only shows a photo when a page-local `localPhoto` file URI is passed in
 * straight from the add-pet wizard). Mirrors `PetSwitcher`'s existing
 * fallback rather than inventing a new one.
 *
 * `testID` stays `home-open-active-pet` -- the C2 checklist + older tests
 * reference it.
 */
export function PetHeroCard({ pet, onPress }: PetHeroCardProps) {
  const speciesLabel = SPECIES_LABEL[pet.species];
  const subtitle = pet.breedSlug ? `${speciesLabel} · ${pet.breedSlug}` : speciesLabel;

  return (
    <Pressable
      testID="home-open-active-pet"
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center gap-4 rounded-2xl bg-white px-4 py-4 shadow-md"
    >
      <View
        testID="home-pet-avatar"
        className="h-16 w-16 items-center justify-center rounded-full bg-brand-100"
      >
        <Text className="text-2xl font-bold text-brand-700">{pet.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View className="flex-1 gap-1">
        <Text testID="home-pet-name" className="text-lg font-semibold text-brand-900">
          {pet.name}
        </Text>
        <Text testID="home-pet-subtitle" className="text-sm text-brand-700">
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward-outline" size={22} color="#1f6350" />
    </Pressable>
  );
}
