import { create } from "zustand";

export interface UpgradeBannerState {
  dismissed: boolean;
  dismiss(): void;
  reset(): void;
}

/**
 * Non-persisted per-session dismissal flag for `<UpgradeRecommendedBanner/>`
 * (T115 plan decision D7, mirrors `billing-banner-store.ts`'s pattern
 * exactly). Dismissing hides the banner for the current session only; it
 * returns on next app launch if the recommended-update condition persists.
 * Never persisted -- no secure-store/migration concerns.
 */
export const useUpgradeBannerStore = create<UpgradeBannerState>()((set) => ({
  dismissed: false,

  dismiss() {
    set({ dismissed: true });
  },

  reset() {
    set({ dismissed: false });
  },
}));
