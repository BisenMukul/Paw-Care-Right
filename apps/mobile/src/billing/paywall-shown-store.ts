import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import { createSafeStorage } from "../storage/safe-storage";

export interface PaywallShownState {
  shown: boolean;
  markShown(): void;
}

// Persisted MMKV store (mirrors `active-pet-store.ts`): the storage layer
// falls back to memory when the native MMKV binding is unavailable (Expo
// Go / jest), so this never crashes at module load.
const mmkv = createSafeStorage({
  createMmkv: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: lazy runtime require so a missing native MMKV binding (Expo Go) falls back instead of crashing at module load
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

/**
 * Whether the onboarding paywall has already been shown once (T074 plan
 * decision 6). Set the moment the onboarding trigger fires, so a later app
 * open never re-shows the onboarding paywall automatically -- the user can
 * still reach it any time via the Settings entry.
 */
export const usePaywallShownStore = create<PaywallShownState>()(
  persist(
    (set) => ({
      shown: false,

      markShown() {
        set({ shown: true });
      },
    }),
    {
      name: "pawcareright.paywall-shown",
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({ shown: state.shown }),
    },
  ),
);
