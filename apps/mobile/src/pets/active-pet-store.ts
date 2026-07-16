import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import { createSafeStorage } from "../storage/safe-storage";

export interface ActivePetState {
  activePetId: string | null;
  setActivePet(id: string): void;
  clear(): void;
}

// A dedicated persisted store for the active-pet selection. The storage layer
// falls back to memory when the native MMKV binding is unavailable.
const mmkv = createSafeStorage({
  createMmkv: () => {
    const { createMMKV } = require("react-native-mmkv");
    return createMMKV();
  },
});
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
