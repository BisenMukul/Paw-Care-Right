import type { Species } from "@pawcareright/types";
import { Pressable, Text, View } from "react-native";

import { strings } from "../strings";

export interface SpeciesPickerProps {
  value: Species | null;
  onChange: (next: Species) => void;
}

function cardClassName(selected: boolean): string {
  return selected
    ? "flex-1 items-center rounded-lg border-2 border-brand-700 dark:border-accent-bright bg-brand-100 dark:bg-surface-raised-dark px-6 py-8"
    : "flex-1 items-center rounded-lg border border-brand-200 dark:border-hairline-dark dark:bg-surface-card-dark px-6 py-8";
}

/** Two selectable DOG/CAT cards for the add-pet wizard's species step. */
export function SpeciesPicker({ value, onChange }: SpeciesPickerProps) {
  return (
    <View className="flex-row gap-4">
      <Pressable
        testID="species-card-dog"
        accessibilityRole="button"
        accessibilityState={{ selected: value === "DOG" }}
        onPress={() => onChange("DOG")}
        className={cardClassName(value === "DOG")}
      >
        <Text className="text-base font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
          {strings.addPet.species.dog}
        </Text>
      </Pressable>
      <Pressable
        testID="species-card-cat"
        accessibilityRole="button"
        accessibilityState={{ selected: value === "CAT" }}
        onPress={() => onChange("CAT")}
        className={cardClassName(value === "CAT")}
      >
        <Text className="text-base font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
          {strings.addPet.species.cat}
        </Text>
      </Pressable>
    </View>
  );
}
