import { Platform } from "react-native";

import { getConfig } from "../config";
import type { PaywallOffering, PaywallPackage, PaywallPackageId, PurchaseOutcome, RestoreOutcome } from "./paywall-types";
import { RC_ENTITLEMENT_ID, RC_PACKAGE_IDS } from "./products";

/**
 * Minimal shape of the `react-native-purchases` default export this service
 * depends on. Kept narrow (only what we call) so the lazy loader's `require`
 * result can be typed without importing the package's own types at module
 * scope (the package cannot load in Expo Go / jest — see `defaultLoader`).
 *
 * The T074 paywall methods (`getOfferings`/`purchasePackage`/
 * `restorePurchases`/`getCustomerInfo`) are declared OPTIONAL: the real RC
 * SDK always implements them, but keeping them optional means the T071
 * mock native fixture (`configure`/`logIn`/`logOut` only, in
 * `__tests__/purchases.test.ts`) stays valid untouched. Every call site
 * below treats an absent method exactly like `native === null` (graceful
 * no-op/error), so production behavior is unaffected.
 */
export interface PurchasesNative {
  configure(opts: { apiKey: string; appUserID: string | null }): void;
  logIn(appUserID: string): Promise<unknown>;
  logOut(): Promise<unknown>;
  getOfferings?(): Promise<unknown>;
  purchasePackage?(pkg: unknown): Promise<unknown>;
  restorePurchases?(): Promise<unknown>;
  getCustomerInfo?(): Promise<unknown>;
}

/** Runtime shapes of the RC objects this file narrows `unknown` into (never imported at module scope — see above). */
interface RcProductShape {
  priceString?: unknown;
  introPrice?: { priceString?: unknown } | null;
}
interface RcPackageShape {
  identifier?: unknown;
  product?: RcProductShape;
}
interface RcOfferingsShape {
  current?: { availablePackages?: unknown[] } | null;
}
interface RcCustomerInfoShape {
  entitlements?: { active?: Record<string, unknown> };
}
interface RcPurchaseErrorShape {
  userCancelled?: unknown;
  code?: unknown;
}

/** Reverse of `RC_PACKAGE_IDS`: RC package identifier -> our `PaywallPackageId`. */
const PACKAGE_ID_BY_RC_ID: Record<string, PaywallPackageId> = Object.fromEntries(
  (Object.entries(RC_PACKAGE_IDS) as Array<[PaywallPackageId, string]>).map(([id, rcId]) => [rcId, id]),
);

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

/**
 * Fetches the current RC offering and normalizes it into our 3
 * `PaywallPackage`s (plan decision 7: prices come ONLY from this offering,
 * never hardcoded). Returns `null` -- never throws, never fabricates a
 * price -- when the native module is absent, `getOfferings` is
 * unsupported, `offerings.current` is missing, or it has no recognized
 * packages (Expo Go / no offering configured yet).
 */
export async function fetchOfferings(): Promise<PaywallOffering | null> {
  if (native === null || native.getOfferings === undefined) {
    return null;
  }

  try {
    const offerings = (await native.getOfferings()) as RcOfferingsShape;
    const availablePackages = offerings.current?.availablePackages;

    if (!Array.isArray(availablePackages) || availablePackages.length === 0) {
      return null;
    }

    const packages: PaywallPackage[] = [];
    for (const raw of availablePackages) {
      const pkg = raw as RcPackageShape;
      const identifier = typeof pkg.identifier === "string" ? pkg.identifier : undefined;
      const id = identifier !== undefined ? PACKAGE_ID_BY_RC_ID[identifier] : undefined;
      const priceString = typeof pkg.product?.priceString === "string" ? pkg.product.priceString : undefined;

      if (id === undefined || priceString === undefined) {
        // Unrecognized package id or missing price -- skip rather than fabricate.
        continue;
      }

      const introPriceString =
        typeof pkg.product?.introPrice?.priceString === "string" ? pkg.product.introPrice.priceString : undefined;

      packages.push({
        id,
        priceString,
        rcPackage: raw,
        ...(introPriceString !== undefined ? { introPriceString } : {}),
      });
    }

    return packages.length > 0 ? { packages } : null;
  } catch {
    return null;
  }
}

function mapPurchaseError(err: unknown): PurchaseOutcome {
  if (typeof err === "object" && err !== null) {
    const e = err as RcPurchaseErrorShape;
    if (e.userCancelled === true) {
      return { status: "cancelled" };
    }
    // Matches `PURCHASES_ERROR_CODE.paymentPendingError`'s string value
    // (plan Risk 3): if this literal drifts from the SDK, worst case a
    // pending purchase renders as a generic error (safe, non-blocking).
    if (e.code === "PAYMENT_PENDING_ERROR") {
      return { status: "pending" };
    }
  }
  return { status: "error" };
}

/**
 * Purchases a package. RESOLVES (never rejects) to a typed
 * `PurchaseOutcome` -- the caller never needs a try/catch (plan decision
 * 8). `native === null`/unsupported -> `{status:"error"}` (no crash, no
 * fake success).
 */
export async function purchasePackage(pkg: PaywallPackage): Promise<PurchaseOutcome> {
  if (native === null || native.purchasePackage === undefined) {
    return { status: "error" };
  }

  try {
    const result = (await native.purchasePackage(pkg.rcPackage)) as { customerInfo?: unknown } | undefined;
    return { status: "success", customerInfo: result?.customerInfo ?? result };
  } catch (err) {
    return mapPurchaseError(err);
  }
}

/**
 * Restores prior purchases. `native === null`/unsupported ->
 * `{status:"error"}`. A successful restore with no active entitlement is
 * `{status:"success", entitled:false}` -- a neutral outcome, never an
 * error (plan Risk 5).
 */
export async function restorePurchases(): Promise<RestoreOutcome> {
  if (native === null || native.restorePurchases === undefined) {
    return { status: "error" };
  }

  try {
    const customerInfo = await native.restorePurchases();
    return { status: "success", entitled: isEntitled(customerInfo) };
  } catch {
    return { status: "error" };
  }
}

/**
 * Fetches the current `customerInfo`, or `null` when the native module is
 * absent/unsupported or the call fails -- callers (the premium store) treat
 * `null` as "leave status unknown", never as "not entitled".
 */
export async function fetchCustomerInfo(): Promise<unknown | null> {
  if (native === null || native.getCustomerInfo === undefined) {
    return null;
  }

  try {
    return await native.getCustomerInfo();
  } catch {
    return null;
  }
}

/** Whether `customerInfo` has our active entitlement (`RC_ENTITLEMENT_ID`). */
export function isEntitled(customerInfo: unknown): boolean {
  if (typeof customerInfo !== "object" || customerInfo === null) {
    return false;
  }

  const ci = customerInfo as RcCustomerInfoShape;
  return ci.entitlements?.active?.[RC_ENTITLEMENT_ID] !== undefined;
}

/** Test-only reset of module state. Not for use outside the test suite. */
export function __resetPurchasesForTest(): void {
  native = null;
  configured = false;
  lastAppUserId = null;
}
