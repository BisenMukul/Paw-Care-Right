import { create } from "zustand";

export interface UpsellState {
  visible: boolean;
  show(): void;
  hide(): void;
}

/**
 * Non-persisted global visibility flag for `<UpsellSheet/>` (T075 plan
 * decision 7). Set by the central `MutationCache.onError` interceptor
 * (`src/api/query.ts`) whenever a gated mutation fails with
 * `PAYMENT_REQUIRED` and isn't suppressed via `meta.skipUpsell`. Always
 * starts hidden — there is no persisted/default-visible state.
 */
export const useUpsellStore = create<UpsellState>()((set) => ({
  visible: false,

  show() {
    set({ visible: true });
  },

  hide() {
    set({ visible: false });
  },
}));
