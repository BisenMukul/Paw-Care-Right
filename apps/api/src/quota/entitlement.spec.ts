import type { BillingEntitlement } from "@pawcareright/types";

import type { BillingService } from "../billing/billing.service";
import { BillingEntitlementResolver, entitlementFromBilling } from "./entitlement";

describe("entitlementFromBilling", () => {
  function billingEntitlement(overrides: Partial<BillingEntitlement> = {}): BillingEntitlement {
    return { entitled: false, source: "none", plan: null, expiresAt: null, billingIssue: false, ...overrides };
  }

  it("entitled:true -> PREMIUM, bypassQuota:false", () => {
    expect(entitlementFromBilling(billingEntitlement({ entitled: true, source: "own" }))).toEqual({
      tier: "PREMIUM",
      bypassQuota: false,
    });
  });

  it("entitled:false -> FREE, bypassQuota:false", () => {
    expect(entitlementFromBilling(billingEntitlement({ entitled: false, source: "none" }))).toEqual({
      tier: "FREE",
      bypassQuota: false,
    });
  });
});

describe("BillingEntitlementResolver", () => {
  it("calls getEntitlement(userId, householdId) and returns the mapped tier", async () => {
    const getEntitlement = jest
      .fn()
      .mockResolvedValue({ entitled: true, source: "family", plan: "family_plan", expiresAt: null, billingIssue: false });
    const billingService = { getEntitlement } as unknown as BillingService;
    const resolver = new BillingEntitlementResolver(billingService);

    const result = await resolver.resolve("user-1", "household-1");

    expect(getEntitlement).toHaveBeenCalledWith("user-1", "household-1");
    expect(result).toEqual({ tier: "PREMIUM", bypassQuota: false });
  });

  it("maps a non-entitled result to FREE", async () => {
    const getEntitlement = jest
      .fn()
      .mockResolvedValue({ entitled: false, source: "none", plan: null, expiresAt: null, billingIssue: false });
    const billingService = { getEntitlement } as unknown as BillingService;
    const resolver = new BillingEntitlementResolver(billingService);

    const result = await resolver.resolve("user-1", "household-1");

    expect(result).toEqual({ tier: "FREE", bypassQuota: false });
  });
});
