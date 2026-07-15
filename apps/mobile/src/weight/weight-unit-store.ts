import { createMMKV } from "react-native-mmkv";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import { getDeviceRegionCode } from "../checks/region";
import { defaultUnitForRegion, type WeightUnit } from "./weight-units";

export interface WeightUnitState {
  override: WeightUnit | null;
  setUnit(unit: WeightUnit): void;
}

// A dedicated MMKV instance for the weight-unit override (mirrors
// `active-pet-store.ts` — plan step 6: each persisted store owns its own
// instance rather than sharing a mobile-wide singleton).
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

export const useWeightUnitStore = create<WeightUnitState>()(
  persist(
    (set) => ({
      override: null,

      setUnit(unit) {
        set({ override: unit });
      },
    }),
    {
      name: "pawcareright.weight-unit",
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({ override: state.override }),
    },
  ),
);

/**
 * Effective display unit: the persisted override when set, else the
 * device-locale default (T065 plan decision 4). `toggle` flips kg↔lb and
 * persists the result as the new override.
 */
export function useWeightUnit(): { unit: WeightUnit; toggle(): void } {
  const override = useWeightUnitStore((state) => state.override);
  const setUnit = useWeightUnitStore((state) => state.setUnit);
  const unit = override ?? defaultUnitForRegion(getDeviceRegionCode());

  return {
    unit,
    toggle() {
      setUnit(unit === "kg" ? "lb" : "kg");
    },
  };
}
