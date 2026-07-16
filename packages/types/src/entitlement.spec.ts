import { billingEntitlementSchema, entitlementSourceSchema, FAMILY_PLAN_PRODUCT_ID } from "./entitlement";

const VALID_PAYLOAD = {
  entitled: true,
  source: "own",
  plan: "pawcareright_monthly",
  expiresAt: "2026-08-01T00:00:00.000Z",
};

describe("billingEntitlementSchema", () => {
  it("parses a valid payload", () => {
    expect(billingEntitlementSchema.parse(VALID_PAYLOAD)).toEqual(VALID_PAYLOAD);
  });

  it("rejects a bad source", () => {
    const payload = { ...VALID_PAYLOAD, source: "premium" };
    expect(billingEntitlementSchema.safeParse(payload).success).toBe(false);
  });

  it("accepts plan: null and expiresAt: null", () => {
    const payload = { entitled: false, source: "none", plan: null, expiresAt: null };
    expect(billingEntitlementSchema.parse(payload)).toEqual(payload);
  });

  it("rejects a non-ISO expiresAt", () => {
    const payload = { ...VALID_PAYLOAD, expiresAt: "not-a-date" };
    expect(billingEntitlementSchema.safeParse(payload).success).toBe(false);
  });
});

describe("entitlementSourceSchema", () => {
  it.each(["own", "family", "none"])("accepts %p", (value) => {
    expect(entitlementSourceSchema.parse(value)).toBe(value);
  });
});

describe("FAMILY_PLAN_PRODUCT_ID", () => {
  it("pins the exact server-side family product id (must match mobile PRODUCT_IDS.family)", () => {
    expect(FAMILY_PLAN_PRODUCT_ID).toBe("pawcareright_family_annual");
  });
});
