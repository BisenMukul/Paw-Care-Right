import { createMMKV } from "react-native-mmkv";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import { type CreatePetInput, createPetSchema, type Sex, type Species } from "@pawcareright/types";

export interface AddPetDraft {
  species: Species | null;
  name: string;
  breedSlug: string | null;
  breedName: string | null;
  sex: Sex | null;
  neutered: boolean | null;
  /** "YYYY-MM-DD" (UI); serialized to ISO for the payload. */
  birthDate: string | null;
  ageEstimateMonths: number | null;
  weightGrams: number | null;
  /** Compressed local file:// uri. */
  photoUri: string | null;
  /** Set once POST /v1/pets succeeds — idempotent resume across Retry. */
  createdPetId: string | null;
}

export interface AddPetState {
  draft: AddPetDraft;
  stepIndex: number;
  setField<K extends keyof AddPetDraft>(key: K, value: AddPetDraft[K]): void;
  setStep(index: number): void;
  setCreatedPetId(id: string): void;
  reset(): void;
}

const INITIAL_DRAFT: AddPetDraft = {
  species: null,
  name: "",
  breedSlug: null,
  breedName: null,
  sex: null,
  neutered: null,
  birthDate: null,
  ageEstimateMonths: null,
  weightGrams: null,
  photoUri: null,
  createdPetId: null,
};

// A second, dedicated MMKV instance for the wizard draft (plan R2 — the
// `src/api/query.ts` "only the root layout imports mmkv" comment is a
// web-bundle isolation note, not a mobile-wide singleton rule; this store is
// never imported by web).
const mmkv = createMMKV();
const mmkvStorage: StateStorage = {
  getItem: (name) => mmkv.getString(name) ?? null,
  setItem: (name, value) => {
    mmkv.set(name, value);
  },
  removeItem: (name) => {
    mmkv.remove(name);
  },
};

/**
 * Builds the `POST /v1/pets` payload from the draft: always includes
 * `species`/`name`, omits every other field that is null/empty, converts
 * `birthDate` from the UI's plain `YYYY-MM-DD` to an ISO datetime, and
 * validates the result against the shared `createPetSchema` (client mirror
 * of the server-authoritative birthDate/ageEstimateMonths XOR rule).
 */
export function buildCreatePetPayload(draft: AddPetDraft): CreatePetInput {
  if (draft.species === null) {
    throw new Error("species is required to build the create-pet payload");
  }

  const payload: CreatePetInput = {
    species: draft.species,
    name: draft.name,
  };

  if (draft.sex !== null) {
    payload.sex = draft.sex;
  }
  if (draft.neutered !== null) {
    payload.neutered = draft.neutered;
  }
  if (draft.breedSlug !== null) {
    payload.breedSlug = draft.breedSlug;
  }
  if (draft.birthDate !== null) {
    payload.birthDate = new Date(`${draft.birthDate}T00:00:00.000Z`).toISOString();
  }
  if (draft.ageEstimateMonths !== null) {
    payload.ageEstimateMonths = draft.ageEstimateMonths;
  }
  if (draft.weightGrams !== null) {
    payload.weightGrams = draft.weightGrams;
  }

  const result = createPetSchema.safeParse(payload);
  if (!result.success) {
    throw new Error(`invalid create-pet payload: ${result.error.message}`);
  }

  return result.data;
}

export const useAddPetStore = create<AddPetState>()(
  persist(
    (set) => ({
      draft: INITIAL_DRAFT,
      stepIndex: 0,

      setField(key, value) {
        set((state) => ({ draft: { ...state.draft, [key]: value } }));
      },

      setStep(index) {
        set({ stepIndex: index });
      },

      setCreatedPetId(id) {
        set((state) => ({ draft: { ...state.draft, createdPetId: id } }));
      },

      reset() {
        set({ draft: INITIAL_DRAFT, stepIndex: 0 });
      },
    }),
    {
      name: "pawcareright.add-pet-draft",
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({ draft: state.draft, stepIndex: state.stepIndex }),
    },
  ),
);
