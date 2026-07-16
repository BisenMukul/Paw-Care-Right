/**
 * Mobile-only paywall view models (T074 plan). These are UI-facing shapes
 * derived from the RC offering / purchase outcome, kept separate from the
 * RC SDK's own types so the rest of the app (screen, stores, hooks) never
 * imports `react-native-purchases` types directly (mirrors the lazy-loader
 * pattern in `purchases.ts`).
 */

/** Our 3 plan identifiers, mapped 1:1 to `RC_PACKAGE_IDS` in `products.ts`. */
export type PaywallPackageId = "monthly" | "annual" | "family";

export interface PaywallPackage {
  id: PaywallPackageId;
  /** Localized price string from the RC offering (e.g. "$4.99/mo"). Never hardcoded. */
  priceString: string;
  /** Localized intro/trial price string, when the package has one. */
  introPriceString?: string;
  /** The raw RC package object, passed back into `purchasePackage` untouched. */
  rcPackage: unknown;
}

export interface PaywallOffering {
  packages: PaywallPackage[];
}

/**
 * `purchasePackage` RESOLVES (never rejects) to this union, mapped from the
 * RC error's fields (plan decision 8): `userCancelled === true` ->
 * cancelled; `code === "PAYMENT_PENDING_ERROR"` -> pending; else error.
 */
export type PurchaseOutcome =
  | { status: "success"; customerInfo: unknown }
  | { status: "cancelled" }
  | { status: "pending" }
  | { status: "error" };

export type RestoreOutcome = { status: "success"; entitled: boolean } | { status: "error" };

/**
 * `"unknown"` = not yet loaded (or the native module is absent, e.g. Expo
 * Go) -- fail-safe, NEVER triggers the onboarding paywall. `"entitled"` /
 * `"free"` are definitive states read from `customerInfo`.
 */
export type PremiumStatus = "unknown" | "entitled" | "free";
