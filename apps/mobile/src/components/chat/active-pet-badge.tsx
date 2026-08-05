import type { Pet } from "@bombaypetcompany/types";
import { Ionicons } from "@expo/vector-icons";
import { Text, useColorScheme, View } from "react-native";

import { strings } from "../../strings";

export interface ActivePetBadgeProps {
  pet: Pet;
}

const SPECIES_LABEL: Record<Pet["species"], string> = {
  DOG: strings.addPet.species.dog,
  CAT: strings.addPet.species.cat,
};

/**
 * Small "who this chat is about" pill (T083 plan). Read-only context, no
 * navigation, no AI content of its own — a plain pet-name + species chip
 * shown under the screen title (design-system §2.5 pill styling, §1.6
 * icon-color-from-scheme rule since `Ionicons` doesn't respond to `dark:`).
 */
export function ActivePetBadge({ pet }: ActivePetBadgeProps) {
  const scheme = useColorScheme();
  const iconColor = scheme === "dark" ? "#2EA57C" : "#1f6350";

  return (
    <View
      testID="chat-active-pet-badge"
      accessibilityLabel={strings.chat.activePetA11y(pet.name)}
      className="flex-row items-center gap-2 self-start rounded-full bg-brand-50 dark:bg-surface-raised-dark px-3 py-1.5"
    >
      <Ionicons name="paw-outline" size={16} color={iconColor} />
      <Text className="text-sm font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">{pet.name}</Text>
      <Text className="text-xs text-brand-700 dark:text-ink-muted-dark font-body">{SPECIES_LABEL[pet.species]}</Text>
    </View>
  );
}
