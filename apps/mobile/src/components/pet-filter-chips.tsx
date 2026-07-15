import { ScrollView, Text } from "react-native";

import { usePets } from "../api/pets-api";
import { strings } from "../strings";

export interface PetFilterChipsProps {
  value: string | null;
  onChange: (petId: string | null) => void;
}

const SELECTED_CLASS = "mr-2 rounded-full bg-brand-700 px-3 py-2 text-sm font-semibold text-white";
const UNSELECTED_CLASS = "mr-2 rounded-full border border-brand-100 px-3 py-2 text-sm text-brand-900";

/**
 * `PetFilterChips` (T060 plan decision 5): `[All, …household pets]` over
 * the existing `usePets()` hook -- no API change, `GET /agenda` already
 * accepts an optional `petId`. `value: null` means "All".
 */
export function PetFilterChips({ value, onChange }: PetFilterChipsProps) {
  const { data: pets } = usePets();

  return (
    <ScrollView horizontal testID="filter-chips-scroll" showsHorizontalScrollIndicator={false}>
      <Text
        testID="filter-chip-all"
        onPress={() => onChange(null)}
        className={value === null ? SELECTED_CLASS : UNSELECTED_CLASS}
      >
        {strings.agenda.filterAll}
      </Text>
      {(pets ?? []).map((pet) => (
        <Text
          key={pet.id}
          testID={`filter-chip-${pet.id}`}
          onPress={() => onChange(pet.id)}
          className={value === pet.id ? SELECTED_CLASS : UNSELECTED_CLASS}
        >
          {pet.name}
        </Text>
      ))}
    </ScrollView>
  );
}
