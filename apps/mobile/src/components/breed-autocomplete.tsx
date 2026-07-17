import type { Species } from "@pawcareright/types";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useBreedSearch } from "../api/breeds-api";
import { strings } from "../strings";
import { Skeleton } from "./skeleton";
import { TextField } from "./text-field";

export interface BreedOption {
  slug: string;
  name: string;
}

export interface BreedAutocompleteProps {
  species: Species | null;
  value: string | null;
  onSelect: (breed: BreedOption) => void;
}

const DEBOUNCE_MS = 300;

/** Debounced breed search feeding `useBreedSearch` (T024 plan). */
export function BreedAutocomplete({ species, onSelect }: BreedAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading, isError } = useBreedSearch(species, debouncedQuery);

  return (
    <View className="gap-3">
      <TextField
        testID="breed-search-input"
        label={strings.addPet.breed.searchPlaceholder}
        value={query}
        onChangeText={setQuery}
        placeholder={strings.addPet.breed.searchPlaceholder}
      />
      {isLoading ? (
        <Skeleton lines={3} testID="breed-loading" />
      ) : isError ? (
        <Text testID="breed-error" accessibilityRole="alert" className="text-sm text-red-700">
          {strings.addPet.breed.error}
        </Text>
      ) : !data || data.length === 0 ? (
        <Text testID="breed-empty" className="text-sm text-brand-700">
          {strings.addPet.breed.empty}
        </Text>
      ) : (
        data.map((breed) => (
          <Pressable
            key={breed.slug}
            testID={`breed-row-${breed.slug}`}
            accessibilityRole="button"
            onPress={() => onSelect({ slug: breed.slug, name: breed.name })}
            className="min-h-[44px] justify-center rounded-lg border border-brand-100 px-4 py-3"
          >
            <Text className="text-base text-brand-900">{breed.name}</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}
