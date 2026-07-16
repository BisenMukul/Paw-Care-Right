import { FAMILY_PLAN_PRODUCT_ID, type BillingEntitlement } from "@pawcareright/types";

import { SUBSCRIPTION_GRACE_MS } from "./billing.constants";

/**
 * The structural subset of a `Subscription` row the resolver needs
 * (T072 plan §"Interfaces/contracts") -- kept prisma-free so this module has
 * no DB dependency and is trivially unit-testable.
 */
export interface SubscriptionRow {
  rcAppUserId: string;
  householdId: string;
  entitlement: "FREE" | "PREMIUM";
  plan: string | null;
  expiresAt: Date | null;
}

/**
 * Plan decision 5 (the grace decision): a row entitles iff it is `PREMIUM`
 * and either has no `expiresAt` or its `expiresAt` (plus the grace knob) is
 * still in the future. The raw `status` string is NOT consulted here -- it
 * is stored for traceability only; `entitlement` + the clock are the sole
 * resolution authority.
 */
export function isSubscriptionActive(row: SubscriptionRow, now: Date): boolean {
  if (row.entitlement !== "PREMIUM") {
    return false;
  }
  return row.expiresAt === null || row.expiresAt.getTime() + SUBSCRIPTION_GRACE_MS > now.getTime();
}

function toIsoOrNull(expiresAt: Date | null): string | null {
  return expiresAt === null ? null : expiresAt.toISOString();
}

/**
 * Among a set of active family rows, picks the one whose grant extends
 * farthest into the future (`expiresAt: null` beats any dated row) --
 * plan decision 6 / risk R5.
 */
function pickLatestExpiring(rows: readonly SubscriptionRow[]): SubscriptionRow {
  return rows.reduce((best, current) => {
    if (best.expiresAt === null) {
      return best;
    }
    if (current.expiresAt === null) {
      return current;
    }
    return current.expiresAt.getTime() > best.expiresAt.getTime() ? current : best;
  });
}

/**
 * Resolves the caller's entitlement (plan decisions 4/6): precedence is
 * own > family > none. `householdSubs` is filtered down to rows whose
 * `plan` is the family product -- a household member's non-family sub
 * never entitles anyone but its own purchaser.
 */
export function pickEntitlement(
  own: SubscriptionRow | null,
  householdSubs: readonly SubscriptionRow[],
  now: Date,
): BillingEntitlement {
  if (own !== null && isSubscriptionActive(own, now)) {
    return { entitled: true, source: "own", plan: own.plan, expiresAt: toIsoOrNull(own.expiresAt) };
  }

  const activeFamilyRows = householdSubs.filter(
    (row) => row.plan === FAMILY_PLAN_PRODUCT_ID && isSubscriptionActive(row, now),
  );

  if (activeFamilyRows.length > 0) {
    const chosen = pickLatestExpiring(activeFamilyRows);
    return { entitled: true, source: "family", plan: chosen.plan, expiresAt: toIsoOrNull(chosen.expiresAt) };
  }

  return { entitled: false, source: "none", plan: null, expiresAt: null };
}
