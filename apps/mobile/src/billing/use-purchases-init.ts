import { useEffect } from "react";

import { type AuthState, useAuthStore } from "../auth/auth-store";

import { identifyPurchaser, initPurchases, resetPurchaser } from "./purchases";

/**
 * Wires the RevenueCat purchaser identity to the auth store lifecycle
 * (mirrors `useNetworkListener`): configures RevenueCat once, then applies
 * `logIn`/`logOut` as the auth status changes. Reads via
 * `useAuthStore.getState()`/`.subscribe()` (non-reactive) so this hook never
 * itself triggers a re-render.
 *
 * Identity is applied only once auth has left `restoring` — `signedIn` ⇒
 * `identifyPurchaser(user.id)`, `signedOut` ⇒ `resetPurchaser()` — so the
 * purchaser is never identified/reset before auth resolves.
 */
export function usePurchasesInit(): void {
  useEffect(() => {
    initPurchases();

    const apply = (state: AuthState) => {
      if (state.status === "signedIn" && state.user) {
        void identifyPurchaser(state.user.id);
      } else if (state.status === "signedOut") {
        void resetPurchaser();
      }
    };

    apply(useAuthStore.getState());
    return useAuthStore.subscribe(apply);
  }, []);
}
