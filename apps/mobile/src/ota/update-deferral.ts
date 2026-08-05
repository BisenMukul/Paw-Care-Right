/**
 * T114: the OTA update-ready deferral guard (docs/OTA_UPDATES.md §3's "hard
 * rule": never interrupt an in-progress symptom check, the Emergency
 * interstitial, checkout, or onboarding with a reload — CLAUDE.md §7/§5).
 * A route's FIRST segment is checked against the set below:
 *
 * - `"check"`   — the whole intake group: `check/index`, `check/[category]`,
 *   `check/waiting/[checkId]`, `check/result/[checkId]`, and (critically)
 *   `check/emergency/[checkId]`, the §5 Emergency interstitial. Also covers
 *   the read-only `check/history/[petId]` — a deliberate over-inclusion.
 * - `"checks"`  — the saved-check detail route (`checks/[id]`); read-only,
 *   also a deliberate over-inclusion.
 * - `"paywall"` — the checkout modal route.
 * - `"(auth)"`  — onboarding: welcome/email/otp/done.
 * - `"add-pet"` — onboarding: species/breed/details/photo/done.
 * - `"push-rationale"` — onboarding: the push-permission rationale screen.
 *
 * The non-route purchase surface (`<UpsellSheet/>`) is NOT a segment — its
 * visibility is checked separately via `useUpsellStore` in
 * `use-update-flow.ts`.
 *
 * Over-inclusion (deferring on read-only routes like `check/history` or
 * `checks/[id]`) is deliberately the safe direction: a delayed silent-apply
 * can never harm anyone, a surprise reload during any of these flows could.
 */
export const DEFERRED_ROOT_SEGMENTS = [
  "check",
  "checks",
  "paywall",
  "(auth)",
  "add-pet",
  "push-rationale",
] as const;

export function isDeferredFlow(segments: readonly (string | undefined)[]): boolean {
  const first = segments[0];
  return first !== undefined && (DEFERRED_ROOT_SEGMENTS as readonly string[]).includes(first);
}
