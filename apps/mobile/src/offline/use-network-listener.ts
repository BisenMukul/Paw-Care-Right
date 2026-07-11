import { useEffect } from "react";
import * as Network from "expo-network";
import { setOnline } from "@pawcareright/api-client";

/**
 * Bridges `expo-network`'s connectivity state into the shared, platform-
 * agnostic online store (`@pawcareright/api-client`'s `setOnline`), so
 * `useIsOffline()` reflects reality without any package depending on a
 * native module. Mounted once, in the root layout.
 */
function toOnline(state: Network.NetworkState): boolean {
  return state.isConnected === true;
}

export function useNetworkListener(): void {
  useEffect(() => {
    let cancelled = false;

    Network.getNetworkStateAsync()
      .then((state) => {
        if (!cancelled) {
          setOnline(toOnline(state));
        }
      })
      .catch(() => {
        // Best-effort initial read; the listener below still keeps state
        // current going forward.
      });

    const subscription = Network.addNetworkStateListener((state) => {
      setOnline(toOnline(state));
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);
}
