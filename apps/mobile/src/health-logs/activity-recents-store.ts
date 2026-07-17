import type { ActivityType, ActivityUnit } from "@pawcareright/types";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import { createSafeStorage } from "../storage/safe-storage";

export interface ActivityRecentEntry {
  activityType: ActivityType;
  quantity?: number;
  unit?: ActivityUnit;
}

const MAX_RECENTS_PER_PET = 3;

export interface ActivityRecentsState {
  byPet: Record<string, ActivityRecentEntry[]>;
  addRecent(petId: string, entry: ActivityRecentEntry): void;
}

// A dedicated persisted store for the "recents" row (design-system §5.1.3),
// mirroring `weight-unit-store.ts`'s exact MMKV-with-memory-fallback pattern
// so a missing native MMKV binding (Expo Go) degrades to memory instead of
// crashing at module load.
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

function sameCombo(a: ActivityRecentEntry, b: ActivityRecentEntry): boolean {
  return a.activityType === b.activityType && a.quantity === b.quantity && a.unit === b.unit;
}

/**
 * The last `MAX_RECENTS_PER_PET` DISTINCT (activityType, quantity, unit)
 * combos per pet, newest first (design-system §5.1.3). `addRecent` dedupes
 * an exact-combo repeat by moving it to the front rather than double-listing.
 */
export const useActivityRecentsStore = create<ActivityRecentsState>()(
  persist(
    (set) => ({
      byPet: {},
      addRecent(petId, entry) {
        set((state) => {
          const existing = state.byPet[petId] ?? [];
          const deduped = existing.filter((item) => !sameCombo(item, entry));
          const next = [entry, ...deduped].slice(0, MAX_RECENTS_PER_PET);
          return { byPet: { ...state.byPet, [petId]: next } };
        });
      },
    }),
    {
      name: "pawcareright.activity-recents",
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({ byPet: state.byPet }),
    },
  ),
);

// A single stable empty-array reference -- returning a fresh `[]` literal
// from the selector below would make every snapshot "change" (new
// reference) on every render, which `useSyncExternalStore` (zustand's
// subscription primitive) reads as "state changed," forcing an infinite
// re-render loop for any pet with no recents yet.
const EMPTY_RECENTS: ActivityRecentEntry[] = [];

/** This pet's recents (newest first), else `[]`. Never throws. */
export function useActivityRecents(petId: string): ActivityRecentEntry[] {
  return useActivityRecentsStore((state) => state.byPet[petId] ?? EMPTY_RECENTS);
}
