import type { Species } from "@pawcareright/types";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "./client";

// `@pawcareright/data` is not a dependency of this workspace (plan keeps the
// new-dependency list to `@pawcareright/types` + the three Expo packages);
// this local shape mirrors the subset of `@pawcareright/data`'s `Breed` the
// autocomplete actually needs (same precedent as `AuthTokens` in
// `auth-api.ts` — not a duplicate of a shape importable here).
export interface BreedRow {
  slug: string;
  name: string;
}

/** Public, unauthenticated breed autocomplete (T024 plan; `BreedsController`). */
export function useBreedSearch(species: Species | null, q: string) {
  return useQuery({
    queryKey: ["breeds", species, q],
    queryFn: () =>
      apiClient.get<BreedRow[]>(`/v1/breeds?species=${species}&q=${encodeURIComponent(q)}`),
    enabled: species != null,
  });
}
