import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import { createSafeStorage } from "../storage/safe-storage";

export interface ConsentState {
  /** Default ON (T078 plan decision 4) -- the user can turn it off in Settings. */
  enabled: boolean;
  setEnabled(value: boolean): void;
}

// Persisted MMKV store (mirrors `paywall-shown-store.ts`): the storage layer
// falls back to memory when the native MMKV binding is unavailable (Expo
// Go / jest), so this never crashes at module load (plan R3/R7).
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
 * Analytics consent (T078 plan decision 4): default ON, with a functional
 * off switch pre-wired in Settings for T091. Gates the MOBILE emitter ONLY
 * (`src/analytics/analytics.ts`'s `isEnabled`) -- server events are not
 * gated in v1 (plan R1).
 */
export const useConsentStore = create<ConsentState>()(
  persist(
    (set) => ({
      enabled: true,

      setEnabled(value: boolean) {
        set({ enabled: value });
      },
    }),
    {
      name: "pawcareright.analytics-consent",
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({ enabled: state.enabled }),
    },
  ),
);
