import { create } from "zustand";

import { fetchCustomerInfo, isEntitled } from "./purchases";
import type { PremiumStatus } from "./paywall-types";

export interface PremiumState {
  status: PremiumStatus;
  setFromCustomerInfo(customerInfo: unknown): void;
  setStatus(status: PremiumStatus): void;
  refresh(): Promise<void>;
}

/**
 * Client entitlement state fed by RC `getCustomerInfo()` (T074 plan
 * decision 3). NON-persisted -- it always starts `"unknown"` on app start
 * and is refreshed by `usePaywallOnboardingTrigger`'s mount effect, then
 * kept current by the paywall screen after purchase/restore.
 *
 * `"unknown"` (native absent -- Expo Go, or not yet refreshed) NEVER reads
 * as entitled or free: it is the fail-safe default so the onboarding
 * trigger (which only fires on `status === "free"`) never nags or blocks
 * on an indeterminate state. This is a separate, non-persisted store from
 * T071's `use-purchases-init.ts`, which is left untouched (plan decision 3).
 */
export const usePremiumStore = create<PremiumState>()((set) => ({
  status: "unknown",

  setFromCustomerInfo(customerInfo) {
    set({ status: isEntitled(customerInfo) ? "entitled" : "free" });
  },

  setStatus(status) {
    set({ status });
  },

  async refresh() {
    const customerInfo = await fetchCustomerInfo();
    if (customerInfo === null) {
      // Native absent or the call failed -- leave/return to "unknown"
      // rather than guessing "free" (fail-safe, plan decision 3).
      return;
    }
    set({ status: isEntitled(customerInfo) ? "entitled" : "free" });
  },
}));
