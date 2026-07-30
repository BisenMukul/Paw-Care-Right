import { PAYWALL_VARIANTS } from "@bombaypetcompany/types";

/**
 * T107 plan D2/D4 — the paywall copy A/B experiment's machine identifiers.
 * Single source of truth: no logic, no I/O, no React. Consumed by the
 * mobile emitters (`apps/mobile/src/experiments/paywall-experiment.ts`) and
 * the experiment doc (`docs/experiments/paywall-ab.md`), and pinned by
 * `./paywall-ab.spec.ts` / `./paywall-ab-doc.spec.ts` so the doc, the
 * registry, and this file can never silently drift from each other.
 *
 * Success metric: `trial_start` rate over `paywall_experiment_exposed`
 * users, per arm. Attribution is PERSON-LEVEL (D2, `docs/experiments/paywall-ab.md`
 * §4) — `trial_start` never carries a `variant` property; PostHog joins the
 * conversion to the correct arm via the shared `distinct_id` (backend
 * `User.id`) already established by `paywall_experiment_exposed`. Kill
 * switch: setting the `PAYWALL_VARIANT` env var to `"A"` on the api forces
 * every user into the control arm (`apps/api/src/config/env.schema.ts`,
 * `apps/api/src/remote-config/variant-assignment.ts`).
 *
 * D4 — min-sample derivation (standard 80%-power / alpha=0.05 two-sided
 * approximation, `n = 16 * pbar * (1 - pbar) / delta^2`): baseline
 * `p = 0.08` (SPEC §8 target >= 8%), target `0.12`, `pbar = 0.10`,
 * `delta = 0.04` -> `16 * 0.1 * 0.9 / 0.04^2 = 900`. This is a DOCUMENTED
 * no-peek threshold, not code-enforced — nothing in this repo can read
 * PostHog counts (no read API, no keys); see doc §5/§8.
 */
export const PAYWALL_EXPERIMENT_KEY = "paywall_copy_ab" as const;
export type PaywallExperimentKey = typeof PAYWALL_EXPERIMENT_KEY;

export const PAYWALL_EXPERIMENT_ARMS = PAYWALL_VARIANTS;

export const PAYWALL_EXPERIMENT_MIN_SAMPLE_PER_ARM = 900;
