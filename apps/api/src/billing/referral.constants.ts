/**
 * T108 referral grant tuning knobs. `REFERRAL_GRANT_DAYS`/
 * `REFERRAL_GRANT_MAX_PER_USER` are the two numbers pinned by the card
 * ("+14 trial days", "max 3 grants/user") and are cross-checked against
 * `docs/referral-grants.md` by `referral-doc.spec.ts` -- changing either
 * here without updating the doc (and the mobile share copy) fails that
 * guard.
 */
export const REFERRAL_GRANT_DAYS = 14;
export const REFERRAL_GRANT_MS = REFERRAL_GRANT_DAYS * 24 * 60 * 60 * 1000;
export const REFERRAL_GRANT_MAX_PER_USER = 3;
