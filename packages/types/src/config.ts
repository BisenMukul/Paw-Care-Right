import { z } from "zod";

/**
 * Remote app-config schema (T074 plan decision 4): the ONLY server-sent
 * field is the paywall A/B variant ID. All paywall copy stays client-side
 * in `strings.ts` (plan decision 5) — the server never sends arbitrary
 * prose, which keeps this surface trivially safe to review (CLAUDE.md §7)
 * and i18n-ready (T110). No Nest/DB imports — this file is consumed by both
 * `apps/api` (response typing) and `apps/mobile` (client parsing).
 */
export const PAYWALL_VARIANTS = ["A", "B"] as const;
export const paywallVariantSchema = z.enum(PAYWALL_VARIANTS);
export type PaywallVariant = z.infer<typeof paywallVariantSchema>;

export const appConfigResponseSchema = z
  .object({
    paywall: z.object({ variant: paywallVariantSchema }),
  })
  .strict();
export type AppConfigResponse = z.infer<typeof appConfigResponseSchema>;
