import type { PaywallVariant } from "@bombaypetcompany/types";
import { useEffect, useState } from "react";

import { useAuthStore } from "../auth/auth-store";
import { usePaywallConfig } from "../billing/paywall-queries";

export interface ResolvedPaywallVariant {
  /** The AUTHENTICATED-confirmed variant, once `resolved` is `true`; otherwise the fallback `"A"` (never used for emission). */
  variant: PaywallVariant;
  /** `true` only once an `/v1/config` fetch has settled while `useAuthStore`'s `status` is `"signedIn"`. */
  resolved: boolean;
}

/**
 * T107 fix-round (checker F1+F2, both HIGH) — the single source of truth
 * for "has this session's paywall variant actually been confirmed by an
 * AUTHENTICATED `/v1/config` response", consumed by BOTH the assignment
 * hook and the paywall's exposure effect so they can never disagree or
 * fire on unresolved data.
 *
 * The problem this fixes: the first `/v1/config` fetch of every cold start
 * races auth restore and is answered ANONYMOUSLY (`OptionalJwtAuthGuard` +
 * no access token yet -> `assignPaywallVariant(undefined, "AUTO")` returns
 * the server's `"A"` default for every user, `variant-assignment.ts`), and
 * the shared `["app-config"]` query's `initialData` fallback
 * (`DEFAULT_APP_CONFIG.variant = "A"`) is indistinguishable from a genuine
 * server answer. Neither is a real per-user assignment. Reporting either
 * one as `paywall_experiment_assigned`/`paywall_experiment_exposed` would
 * inflate arm A and (if a later authenticated refetch changes the answer)
 * place a single person's exposure in BOTH arms.
 *
 * The fix: wait for `useAuthStore`'s `status` to become `"signedIn"` (by
 * which point `accessToken` is ALREADY set — the same `set()` call in
 * `auth-store.ts` assigns both fields atomically), then explicitly
 * `refetch()` the shared `["app-config"]` query so the specific request
 * that determines `variant` is guaranteed to carry the token, and only
 * mark `resolved: true` once THAT fetch settles. `resolved` stays `false`
 * for the entire signed-out/restoring window and for warm-MMKV-cache
 * sessions until the authenticated re-check completes. Callers MUST NOT
 * emit any experiment event while `resolved` is `false`.
 *
 * Residual honesty note (documented, not hidden — see
 * `docs/experiments/paywall-ab.md` §3): if the authenticated refetch itself
 * fails (offline, server error), this resolves with whatever that failed
 * fetch's `data` last was (typically the anonymous/cached value) rather
 * than blocking forever — a fail-open default consistent with the rest of
 * this config surface. A user who never regains connectivity while
 * signed in may therefore still be reported once, using a lower-confidence
 * variant; this is a rarer, disclosed residual, not the deterministic
 * every-cold-start bug F1/F2 fixed.
 */
export function useResolvedPaywallVariant(): ResolvedPaywallVariant {
  const status = useAuthStore((state) => state.status);
  const query = usePaywallConfig();
  const [hasResolvedOnce, setHasResolvedOnce] = useState(false);

  useEffect(() => {
    if (status !== "signedIn") {
      return;
    }

    let cancelled = false;
    void query.refetch().then(() => {
      if (!cancelled) {
        setHasResolvedOnce(true);
      }
    });

    return () => {
      cancelled = true;
    };
    // Deliberately `[status]` only (this repo has no `react-hooks/exhaustive-deps`
    // lint rule active, so this is a plain comment, not a suppression): the
    // explicit re-authenticated refetch runs ONLY on a `status` transition
    // into `"signedIn"` (that is the one moment an anonymous cache entry can
    // become stale-in-the-good-way); `query.refetch` is TanStack Query's
    // stable per-observer method, not state this effect should react to.
    // Once resolved, `variant` below still tracks the LIVE shared cache
    // reactively (D3/R3: a later change to an ALREADY-authenticated session,
    // e.g. the paywall's own observer refetching, is legitimately a new
    // variant to report -- see the plan's mid-session R3 test).
  }, [status]);

  return {
    variant: hasResolvedOnce ? (query.data?.variant ?? "A") : "A",
    resolved: hasResolvedOnce,
  };
}
