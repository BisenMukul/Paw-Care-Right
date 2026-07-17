import type { Pet } from "@pawcareright/types";
import { Image } from "expo-image";
import { Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { derivePetAgeLabel } from "../pets/pet-age";
import { HEADER_CARD_HEIGHT } from "../pets/pet-home-layout";
import { strings } from "../strings";

export interface PetHeaderCardProps {
  pet: Pet;
  localPhoto?: string;
}

const SPECIES_LABEL: Record<Pet["species"], string> = {
  DOG: strings.addPet.species.dog,
  CAT: strings.addPet.species.cat,
};

/**
 * Presentational pet hero card (T025 plan, restyled by the founder UI/UX
 * pass): a larger avatar — a photo when `localPhoto` is supplied, else the
 * SAME initial-letter fallback used elsewhere in the app (`PetSwitcher`'s
 * `PetAvatar`, the home tab's `PetHeroCard`) — the pet's name prominent,
 * and species/breed/age as small rounded chips. FadeInDown entrance.
 *
 * Fixed `HEADER_CARD_HEIGHT` so the above-the-fold budget test (plan
 * §AC2b) can bind its arithmetic to this component's actually-applied
 * style. No data fetching.
 */
export function PetHeaderCard({ pet, localPhoto }: PetHeaderCardProps) {
  const ageLabel = derivePetAgeLabel(pet);
  const speciesLabel = SPECIES_LABEL[pet.species];

  return (
    <Animated.View
      testID="pet-home-header-card"
      entering={FadeInDown.duration(320)}
      style={{ height: HEADER_CARD_HEIGHT }}
      className="flex-row items-center gap-4 rounded-2xl bg-white px-4 shadow-md"
    >
      {localPhoto ? (
        <Image testID="pet-home-photo" source={{ uri: localPhoto }} className="h-24 w-24 rounded-full" />
      ) : (
        <View
          testID="pet-home-photo-placeholder"
          className="h-24 w-24 items-center justify-center rounded-full bg-brand-100"
        >
          <Text className="text-3xl font-bold text-brand-700">{pet.name.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View className="flex-1 gap-2">
        <Text testID="pet-home-name" className="text-2xl font-bold text-brand-900">
          {pet.name}
        </Text>
        <View className="flex-row flex-wrap items-center gap-2">
          <View testID="pet-home-species" className="rounded-full bg-brand-50 px-3 py-1">
            <Text className="text-xs font-medium text-brand-700">{speciesLabel}</Text>
          </View>
          {pet.breedSlug ? (
            <View className="rounded-full bg-brand-50 px-3 py-1">
              <Text testID="pet-home-breed" className="text-xs font-medium text-brand-700">
                {pet.breedSlug}
              </Text>
            </View>
          ) : null}
          <View className="rounded-full bg-brand-50 px-3 py-1">
            <Text testID="pet-home-age" className="text-xs font-medium text-brand-700">
              {ageLabel}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}
