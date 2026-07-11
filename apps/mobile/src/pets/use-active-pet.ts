import type { Pet } from "@pawcareright/types";
import { useEffect } from "react";

import { usePets } from "../api/pets-api";
import { useActivePetStore } from "./active-pet-store";

export interface UseActivePetResult {
  pet: Pet | null;
  pets: Pet[];
  activePetId: string | null;
  setActivePet: (id: string) => void;
  isLoading: boolean;
  isError: boolean;
}

/**
 * THE single hook every pet-scoped screen reads (T027 plan): composes the
 * pets list with the persisted active-pet selection and auto-heals a
 * stale/missing selection to the first pet (plan D2 — reconciliation lives
 * only here, keeping `active-pet-store` a dumb persisted value).
 */
export function useActivePet(): UseActivePetResult {
  const { data: pets = [], isLoading, isError } = usePets();
  const activePetId = useActivePetStore((s) => s.activePetId);
  const setActivePet = useActivePetStore((s) => s.setActivePet);

  useEffect(() => {
    const firstPet = pets[0];
    if (
      !isLoading &&
      firstPet !== undefined &&
      (activePetId == null || !pets.some((p) => p.id === activePetId))
    ) {
      setActivePet(firstPet.id);
    }
  }, [isLoading, pets, activePetId, setActivePet]);

  const pet = pets.find((p) => p.id === activePetId) ?? pets[0] ?? null;

  return { pet, pets, activePetId, setActivePet, isLoading, isError };
}
