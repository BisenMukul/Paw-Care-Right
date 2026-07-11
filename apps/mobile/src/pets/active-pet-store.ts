import { createMMKV } from "react-native-mmkv";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

export interface ActivePetState {
  activePetId: string | null;
  setActivePet(id: string): void;
  clear(): void;
}

// A dedicated MMKV instance for the active-pet selection (mirrors the
// `add-pet-store.ts` pattern — plan step 2; each persisted store owns its
// own instance rather than sharing a mobile-wide singleton).
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

export const useActivePetStore = create<ActivePetState>()(
  persist(
    (set) => ({
      activePetId: null,

      setActivePet(id) {
        set({ activePetId: id });
      },

      clear() {
        set({ activePetId: null });
      },
    }),
    {
      name: "pawcareright.active-pet",
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({ activePetId: state.activePetId }),
    },
  ),
);
