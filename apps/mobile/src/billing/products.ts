/**
 * RevenueCat + store product-id constants (single source of truth).
 *
 * These exact strings mirror `docs/store-setup.md` §2 (Fixed identifiers
 * table) verbatim — CLAUDE.md §1a naming: no `+`/spaces in identifiers, so
 * every store/RC identifier below is a brand-prefixed snake_case or
 * RevenueCat-reserved token. Do NOT hardcode these values anywhere else;
 * import from this module instead (a test in `__tests__/purchases.test.ts`
 * pins these against the doc so the two can never drift).
 */

/** RevenueCat entitlement id granting "Plus" premium access. */
export const RC_ENTITLEMENT_ID = "plus" as const;

/** RevenueCat offering id presented to all users at paywall time (T073). */
export const RC_OFFERING_ID = "default" as const;

/** App Store Connect / Play Console product ids (identical on both stores). */
export const PRODUCT_IDS = {
  monthly: "pawcareright_monthly",
  annual: "pawcareright_annual",
  family: "pawcareright_family_annual",
} as const;

/**
 * RevenueCat package identifiers within the `default` offering. `monthly`
 * and `annual` use RC's reserved `$rc_*` package ids; `family` is a custom
 * package id (RC has no reserved token for a family-tier package).
 */
export const RC_PACKAGE_IDS = {
  monthly: "$rc_monthly",
  annual: "$rc_annual",
  family: "family",
} as const;
