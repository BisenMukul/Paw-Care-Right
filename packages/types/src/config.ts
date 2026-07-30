import { z } from "zod";

/**
 * Remote app-config schema (T074 plan decision 4; grown by T079 plan
 * decision 6; grown by T106 for feature kill switches). Server-sent fields:
 * the paywall A/B variant ID, the minimum-supported-client-version gate, the
 * bundled hotline-pack version tag, and the `features` kill-switch flags.
 * All paywall COPY stays client-side in `strings.ts` (plan decision 5) — the
 * server never sends arbitrary prose, which keeps this surface trivially
 * safe to review (CLAUDE.md §7) and i18n-ready (T110). No Nest/DB imports —
 * this file is consumed by both `apps/api` (response typing) and
 * `apps/mobile` (client parsing).
 *
 * T106: `features` are booleans only, never prose (§7 review surface) —
 * a flag can only turn a surface on/off, it can never carry copy.
 */
export const PAYWALL_VARIANTS = ["A", "B"] as const;
export const paywallVariantSchema = z.enum(PAYWALL_VARIANTS);
export type PaywallVariant = z.infer<typeof paywallVariantSchema>;

export const FEATURE_KEYS = ["checks", "chat", "paywall"] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const featureFlagsSchema = z
  .object({
    checks: z.boolean(),
    chat: z.boolean(),
    paywall: z.boolean(),
  })
  .strict();
export type FeatureFlags = z.infer<typeof featureFlagsSchema>;

export const appConfigResponseSchema = z
  .object({
    paywall: z.object({ variant: paywallVariantSchema }),
    minSupportedVersion: z.string(),
    hotlinePackVersion: z.number().int().nonnegative(),
    features: featureFlagsSchema,
  })
  .strict();
export type AppConfigResponse = z.infer<typeof appConfigResponseSchema>;
