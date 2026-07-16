import { z } from "zod";

/**
 * Billing entitlement shapes (T072 plan decision 3/6): mirrors ARCHITECTURE
 * §3's `Subscription` mirror model. `FAMILY_PLAN_PRODUCT_ID` is the single
 * server-side source of truth for "this row is a family plan" — it MUST
 * equal the mobile `PRODUCT_IDS.family` in
 * `apps/mobile/src/billing/products.ts` (T071-owned; not edited here, so
 * this is a documented drift point, not an enforced one).
 */
export const FAMILY_PLAN_PRODUCT_ID = "pawcareright_family_annual" as const;

export const entitlementSourceSchema = z.enum(["own", "family", "none"]);

export const billingEntitlementSchema = z.object({
  entitled: z.boolean(),
  source: entitlementSourceSchema,
  plan: z.string().nullable(),
  expiresAt: z.string().datetime().nullable(),
  billingIssue: z.boolean(),
});

export type EntitlementSource = z.infer<typeof entitlementSourceSchema>;
export type BillingEntitlement = z.infer<typeof billingEntitlementSchema>;
