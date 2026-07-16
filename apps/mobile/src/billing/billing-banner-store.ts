import { create } from "zustand";

export interface BillingBannerState {
  dismissed: boolean;
  dismiss(): void;
  reset(): void;
}

/**
 * Non-persisted per-session dismissal flag for `<BillingIssueBanner/>` (T076
 * plan decision 3, mirrors `upsell-store.ts`'s pattern). Dismissing hides the
 * banner for the current session only; it returns on next app launch if the
 * server-mirrored billing issue persists. Never persisted -- no
 * secure-store/migration concerns.
 */
export const useBillingBannerStore = create<BillingBannerState>()((set) => ({
  dismissed: false,

  dismiss() {
    set({ dismissed: true });
  },

  reset() {
    set({ dismissed: false });
  },
}));
