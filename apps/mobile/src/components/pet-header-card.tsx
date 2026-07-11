import type { Pet } from "@pawcareright/types";
import { Image } from "expo-image";
import { Text, View } from "react-native";

import { derivePetAgeLabel } from "../pets/pet-age";
import { HEADER_CARD_HEIGHT } from "../pets/pet-home-layout";

export interface PetHeaderCardProps {
  pet: Pet;
  localPhoto?: string;
}

/**
 * Presentational pet header card (T025): photo, name, derived age, breed.
 * No data fetching. Fixed `HEADER_CARD_HEIGHT` so the above-the-fold budget
 * test (plan §AC2b) can bind its arithmetic to this component's
 * actually-applied style.
 */
export function PetHeaderCard({ pet, localPhoto }: PetHeaderCardProps) {
  return (
    <View
      testID="pet-home-header-card"
      style={{ height: HEADER_CARD_HEIGHT }}
      className="flex-row items-center gap-4 rounded-lg bg-brand-50 px-4"
    >
      {localPhoto ? (
        <Image
          testID="pet-home-photo"
          source={{ uri: localPhoto }}
          className="h-20 w-20 rounded-full"
        />
      ) : (
        <View testID="pet-home-photo-placeholder" className="h-20 w-20 rounded-full bg-brand-100" />
      )}
      <View className="flex-1 gap-1">
        <Text testID="pet-home-name" className="text-xl font-semibold text-brand-900">
          {pet.name}
        </Text>
        <Text testID="pet-home-age" className="text-base text-brand-900">
          {derivePetAgeLabel(pet)}
        </Text>
        {pet.breedSlug ? (
          <Text testID="pet-home-breed" className="text-base text-brand-900">
            {pet.breedSlug}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
