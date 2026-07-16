import { Platform } from "react-native";

import { getConfig } from "../config";

/**
 * Minimal shape of the `react-native-purchases` default export this service
 * depends on. Kept narrow (only what we call) so the lazy loader's `require`
 * result can be typed without importing the package's own types at module
 * scope (the package cannot load in Expo Go / jest — see `defaultLoader`).
 */
export interface PurchasesNative {
  configure(opts: { apiKey: string; appUserID: string | null }): void;
  logIn(appUserID: string): Promise<unknown>;
  logOut(): Promise<unknown>;
}

export type PurchasesLoader = () => PurchasesNative | null;

/**
 * Lazy runtime require of `react-native-purchases`, mirroring the
 * `createSafeStorage`/MMKV pattern (`src/storage/safe-storage.ts`,
 * `src/pets/active-pet-store.ts`): the native module cannot load in Expo Go
 * or the jest container, so it is never imported at module top level. A
 * failed `require` (module absent) resolves to `null`, and every caller in
 * this file treats `null` as "no-op gracefully" rather than throwing.
 */
const defaultLoader: PurchasesLoader = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: lazy runtime require so a missing native RevenueCat binding (Expo Go) falls back instead of crashing at module load
    const mod = require("react-native-purchases");
    return (mod?.default ?? null) as PurchasesNative | null;
  } catch {
    return null;
  }
};

let native: PurchasesNative | null = null;
let configured = false;
let lastAppUserId: string | null = null;

export interface InitPurchasesOptions {
  loader?: PurchasesLoader;
  iosKey?: string;
  androidKey?: string;
  platformOS?: string;
}

/**
 * Configures RevenueCat anonymously (`appUserID: null`) exactly once.
 * Idempotent: a second call (double-mount / Fast Refresh) is a no-op that
 * returns the previous configure result. When the native module cannot be
 * loaded (Expo Go, jest), this no-ops gracefully and returns `false` — the
 * app boots regardless.
 */
export function initPurchases(opts: InitPurchasesOptions = {}): boolean {
  if (configured) {
    return native !== null;
  }

  const loader = opts.loader ?? defaultLoader;
  native = loader();
  configured = true;

  if (native === null) {
    return false;
  }

  const config = getConfig();
  const platformOS = opts.platformOS ?? Platform.OS;
  const iosKey = opts.iosKey ?? config.revenueCatIosKey;
  const androidKey = opts.androidKey ?? config.revenueCatAndroidKey;
  const apiKey = platformOS === "android" ? androidKey : iosKey;

  native.configure({ apiKey, appUserID: null });
  return true;
}

/**
 * Identifies the RevenueCat purchaser as the backend `userId`. No-op if
 * `initPurchases` never resolved the native module, or if `userId` matches
 * the last identity applied (dedups repeated `logIn` calls from the auth
 * store's `subscribe`, which fires on every state change, not just
 * sign-in). Best-effort: a rejected `logIn` is swallowed so an identity
 * hiccup never crashes the app or blocks the auth flow.
 */
export async function identifyPurchaser(userId: string): Promise<void> {
  if (native === null || userId === lastAppUserId) {
    return;
  }

  try {
    await native.logIn(userId);
    lastAppUserId = userId;
  } catch {
    // Best-effort: identity failures never crash the app.
  }
}

/**
 * Resets the RevenueCat purchaser to anonymous on sign-out. No-op if the
 * native module is absent or already anonymous (`lastAppUserId === null`).
 */
export async function resetPurchaser(): Promise<void> {
  if (native === null || lastAppUserId === null) {
    return;
  }

  try {
    await native.logOut();
    lastAppUserId = null;
  } catch {
    // Best-effort: identity failures never crash the app.
  }
}

/** Whether the native RevenueCat module resolved (vs. Expo Go no-op mode). */
export function isPurchasesConfigured(): boolean {
  return native !== null;
}

/** Test-only reset of module state. Not for use outside the test suite. */
export function __resetPurchasesForTest(): void {
  native = null;
  configured = false;
  lastAppUserId = null;
}
