import { useSyncExternalStore } from "react";

// Module-level online/offline store, shared by every consumer of this
// package (web + mobile). Zero new dependencies: `react` is already a peer
// dependency of `@pawcareright/api-client` (see `query-provider.tsx`).
// Network-detection plumbing (e.g. `expo-network` on mobile) calls
// `setOnline`; UI reads the state via `useIsOffline`.
let online = true;
const listeners = new Set<() => void>();

/** Updates the shared online state; notifies subscribers only on an actual change. */
export function setOnline(next: boolean): void {
  if (next === online) {
    return;
  }
  online = next;
  listeners.forEach((listener) => listener());
}

/** `useSyncExternalStore` subscribe function; also directly unit-testable. */
export function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/** `useSyncExternalStore` snapshot function; also directly unit-testable. */
export function getIsOfflineSnapshot(): boolean {
  return !online;
}

/** React hook: `true` when the shared store has been marked offline. */
export function useIsOffline(): boolean {
  return useSyncExternalStore(subscribe, getIsOfflineSnapshot);
}
