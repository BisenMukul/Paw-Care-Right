import { ScrollView } from "react-native";

import { usePets } from "../api/pets-api";
import { strings } from "../strings";
import { Chip } from "./chip";

export interface PetFilterChipsProps {
  value: string | null;
  onChange: (petId: string | null) => void;
}

/**
 * `PetFilterChips` (T060 plan decision 5): `[All, …household pets]` over
 * the existing `usePets()` hook -- no API change, `GET /agenda` already
 * accepts an optional `petId`. `value: null` means "All". Canon `Chip`
 * (design-system.md §2.5, SWEEP-4 batch 4).
 */
export function PetFilterChips({ value, onChange }: PetFilterChipsProps) {
  const { data: pets } = usePets();

  return (
    <ScrollView
      horizontal
      testID="filter-chips-scroll"
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2"
    >
      <Chip
        testID="filter-chip-all"
        label={strings.agenda.filterAll}
        selected={value === null}
        onPress={() => onChange(null)}
      />
      {(pets ?? []).map((pet) => (
        <Chip
          key={pet.id}
          testID={`filter-chip-${pet.id}`}
          label={pet.name}
          selected={value === pet.id}
          onPress={() => onChange(pet.id)}
        />
      ))}
    </ScrollView>
  );
}
