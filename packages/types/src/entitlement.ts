import { z } from "zod";

/**
 * Billing entitlement shapes (T072 plan decision 3/6): mirrors ARCHITECTURE
 * §3's `Subscription` mirror model. `FAMILY_PLAN_PRODUCT_ID` is the single
 * server-side source of truth for "this row is a family plan" — it MUST
 * equal the mobile `PRODUCT_IDS.family` in
 * `apps/mobile/src/billing/products.ts` (T071-owned; not edited here, so
 * this is a documented drift point, not an enforced one).
 */
export const FAMILY_PLAN_PRODUCT_ID = "bombaypetcompany_family_annual" as const;

/**
 * `"grant"` (T108 plan D1/D2): a server-side referral grace window
 * (`ReferralGrant`) — a parallel, RC-free entitlement input. Precedence is
 * own > family > grant > none; a grant NEVER overrides or derives from a
 * `Subscription` row.
 */
export const entitlementSourceSchema = z.enum(["own", "family", "grant", "none"]);

export const billingEntitlementSchema = z.object({
  entitled: z.boolean(),
  source: entitlementSourceSchema,
  plan: z.string().nullable(),
  expiresAt: z.string().datetime().nullable(),
  billingIssue: z.boolean(),
});

export type EntitlementSource = z.infer<typeof entitlementSourceSchema>;
export type BillingEntitlement = z.infer<typeof billingEntitlementSchema>;
