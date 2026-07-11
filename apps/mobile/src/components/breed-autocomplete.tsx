import type { Species } from "@pawcareright/types";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { useBreedSearch } from "../api/breeds-api";
import { strings } from "../strings";

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
      <TextInput
        testID="breed-search-input"
        value={query}
        onChangeText={setQuery}
        placeholder={strings.addPet.breed.searchPlaceholder}
        className="rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900"
      />
      {isLoading ? (
        <ActivityIndicator testID="breed-loading" />
      ) : isError ? (
        <Text testID="breed-error" className="text-sm text-red-600">
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
            onPress={() => onSelect({ slug: breed.slug, name: breed.name })}
            className="rounded-lg border border-gray-200 px-4 py-3"
          >
            <Text className="text-base text-brand-900">{breed.name}</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}
