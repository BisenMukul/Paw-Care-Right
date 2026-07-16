import { Inject, Injectable } from "@nestjs/common";
import type { BillingEntitlement } from "@pawcareright/types";

import { BillingService } from "../billing/billing.service";
import type { Entitlement } from "./quota.types";

/** DI token for the injectable {@link EntitlementResolver}. */
export const ENTITLEMENT_RESOLVER = "ENTITLEMENT_RESOLVER";

export interface EntitlementResolver {
  resolve(userId: string, householdId: string): Promise<Entitlement>;
}

/**
 * Pure mapper (T075 plan decision 2): a household's billing entitlement
 * (T072's `BillingService.getEntitlement`) maps to the quota-facing
 * `Entitlement` shape. `bypassQuota` is always `false` here — real premium
 * still observes the `PREMIUM` fair-use cap (plan decision 4); only a test
 * double bypasses quota outright.
 */
export function entitlementFromBilling(entitlement: BillingEntitlement): Entitlement {
  return { tier: entitlement.entitled ? "PREMIUM" : "FREE", bypassQuota: false };
}

/**
 * v1 placeholder resolver: everyone is FREE, no bypass. Retained (T075 plan)
 * as a fallback/test double now that `BillingEntitlementResolver` is the
 * real DI-provided implementation.
 */
@Injectable()
export class StaticEntitlementResolver implements EntitlementResolver {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async resolve(_userId: string, _householdId: string): Promise<Entitlement> {
    return { tier: "FREE", bypassQuota: false };
  }
}

/**
 * Real (T075) resolver: delegates to T072's `BillingService.getEntitlement`
 * (household-scoped — SPEC §7) and maps the result via
 * {@link entitlementFromBilling}. This is the ONE seam every gated surface
 * (checks/pets/households) consumes — no duplicated billing→quota mapping.
 */
@Injectable()
export class BillingEntitlementResolver implements EntitlementResolver {
  constructor(@Inject(BillingService) private readonly billingService: BillingService) {}

  async resolve(userId: string, householdId: string): Promise<Entitlement> {
    const entitlement = await this.billingService.getEntitlement(userId, householdId);
    return entitlementFromBilling(entitlement);
  }
}
