import { z } from "zod";

/**
 * Remote app-config schema (T074 plan decision 4; grown by T079 plan
 * decision 6). Server-sent fields: the paywall A/B variant ID, the
 * minimum-supported-client-version gate, and the bundled hotline-pack
 * version tag. All paywall COPY stays client-side in `strings.ts` (plan
 * decision 5) — the server never sends arbitrary prose, which keeps this
 * surface trivially safe to review (CLAUDE.md §7) and i18n-ready (T110). No
 * Nest/DB imports — this file is consumed by both `apps/api` (response
 * typing) and `apps/mobile` (client parsing).
 */
export const PAYWALL_VARIANTS = ["A", "B"] as const;
export const paywallVariantSchema = z.enum(PAYWALL_VARIANTS);
export type PaywallVariant = z.infer<typeof paywallVariantSchema>;

export const appConfigResponseSchema = z
  .object({
    paywall: z.object({ variant: paywallVariantSchema }),
    minSupportedVersion: z.string(),
    hotlinePackVersion: z.number().int().nonnegative(),
  })
  .strict();
export type AppConfigResponse = z.infer<typeof appConfigResponseSchema>;
