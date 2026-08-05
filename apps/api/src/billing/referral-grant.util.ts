import { REFERRAL_GRANT_MAX_PER_USER, REFERRAL_GRANT_MS } from "./referral.constants";

/**
 * The structural subset of a `ReferralGrant` row this module needs -- kept
 * prisma-free (mirrors `entitlement.util.ts`'s `SubscriptionRow` style) so
 * it is trivially unit-testable with no DB dependency.
 */
export interface ReferralGrantRow {
  startsAt: Date;
  expiresAt: Date;
}

/**
 * D4 (effective grant expiry = contiguous chain fold): sorts the recipient's
 * grants by `startsAt` and walks forward, extending a running cursor only
 * while the next grant's window starts at or before the cursor (i.e. it is
 * part of the same unbroken chain). A grant with a gap before it (its
 * `startsAt` is AFTER the cursor -- meaning the chain already lapsed) is
 * ignored, matching D9: a lapsed, unclaimed window confers no benefit.
 * Returns `null` when the folded cursor is not still in the future.
 */
export function resolveGrantExpiry(grants: readonly ReferralGrantRow[], now: Date): Date | null {
  const sorted = [...grants].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  let cursor = now.getTime();
  for (const grant of sorted) {
    if (grant.startsAt.getTime() <= cursor) {
      cursor = Math.max(cursor, grant.expiresAt.getTime());
    }
  }

  return cursor > now.getTime() ? new Date(cursor) : null;
}

/**
 * D3 (grant math = chained, non-overlapping windows): the next grant for a
 * recipient starts at `max(now, tip of their existing grants)` and runs for
 * exactly `REFERRAL_GRANT_MS`. N SERIALIZED calls therefore cover exactly
 * N x14 days, never overlapping -- a grant issued after a gap (the previous
 * chain already lapsed) starts fresh at `now`, not at the stale tip.
 *
 * FIX ROUND (checker F2): this function is pure and has NO concurrency
 * guarantee of its own -- two concurrent callers reading the same `existing`
 * array before either has inserted would both compute an overlapping window
 * (both `startsAt === now`), losing the chain. The original plan's D3
 * wording ("never lost to concurrency") overstated what this pure function
 * alone provides; the actual guarantee against concurrent callers is
 * provided by `ReferralGrantService`'s per-recipient
 * `pg_advisory_xact_lock` (serializing the read-then-write for a given
 * recipient), not by this function. See `referral-grant.service.ts`'s class
 * doc comment and `docs/referral-grants.md` §2.
 */
export function computeGrantWindow(
  existing: readonly ReferralGrantRow[],
  now: Date,
): { startsAt: Date; expiresAt: Date } {
  const tip = existing.reduce((max, grant) => Math.max(max, grant.expiresAt.getTime()), 0);
  const startsAt = new Date(Math.max(now.getTime(), tip));
  const expiresAt = new Date(startsAt.getTime() + REFERRAL_GRANT_MS);
  return { startsAt, expiresAt };
}

/**
 * D5/D6 (lifetime cap, silent-skip): a recipient who has already RECEIVED
 * `REFERRAL_GRANT_MAX_PER_USER` grants (counted regardless of whether they
 * were inviter or joiner on each) may receive no further grant. This is a
 * pure boundary check -- callers (`ReferralGrantService`) are responsible
 * for treating a cap hit as a silent skip, never a thrown error, so an
 * abuse guard can never fail a household join.
 */
export function isGrantCapReached(existingCount: number): boolean {
  return existingCount >= REFERRAL_GRANT_MAX_PER_USER;
}
