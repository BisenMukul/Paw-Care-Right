import { Pressable, ScrollView, Text } from "react-native";

import { usePets } from "../api/pets-api";
import { strings } from "../strings";

export interface PetFilterChipsProps {
  value: string | null;
  onChange: (petId: string | null) => void;
}

// Touch-target-only fix (design-system.md §4.1): the bare `Text onPress`
// chip is a ~33pt tall tap target -- wrapping in a `Pressable` with
// `min-h-[44px]` reaches the WCAG/HIG floor without restyling colors
// (full `Chip` canon extraction is deferred to batch 4).
const CONTAINER_SELECTED = "mr-2 min-h-[44px] justify-center rounded-full bg-brand-700 px-3";
const CONTAINER_UNSELECTED = "mr-2 min-h-[44px] justify-center rounded-full border border-brand-100 px-3";
const TEXT_SELECTED = "text-sm font-semibold text-white";
const TEXT_UNSELECTED = "text-sm text-brand-900";

/**
 * `PetFilterChips` (T060 plan decision 5): `[All, …household pets]` over
 * the existing `usePets()` hook -- no API change, `GET /agenda` already
 * accepts an optional `petId`. `value: null` means "All".
 */
export function PetFilterChips({ value, onChange }: PetFilterChipsProps) {
  const { data: pets } = usePets();

  return (
    <ScrollView horizontal testID="filter-chips-scroll" showsHorizontalScrollIndicator={false}>
      <Pressable
        testID="filter-chip-all"
        onPress={() => onChange(null)}
        accessibilityRole="button"
        accessibilityState={{ selected: value === null }}
        className={value === null ? CONTAINER_SELECTED : CONTAINER_UNSELECTED}
      >
        <Text className={value === null ? TEXT_SELECTED : TEXT_UNSELECTED}>{strings.agenda.filterAll}</Text>
      </Pressable>
      {(pets ?? []).map((pet) => (
        <Pressable
          key={pet.id}
          testID={`filter-chip-${pet.id}`}
          onPress={() => onChange(pet.id)}
          accessibilityRole="button"
          accessibilityState={{ selected: value === pet.id }}
          className={value === pet.id ? CONTAINER_SELECTED : CONTAINER_UNSELECTED}
        >
          <Text className={value === pet.id ? TEXT_SELECTED : TEXT_UNSELECTED}>{pet.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
