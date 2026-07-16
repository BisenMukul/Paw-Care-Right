import { RC_ENTITLEMENT_ID, RC_PACKAGE_IDS } from "../src/billing/products";
import {
  __resetPurchasesForTest,
  fetchCustomerInfo,
  fetchOfferings,
  initPurchases,
  isEntitled,
  purchasePackage,
  restorePurchases,
  type PurchasesNative,
} from "../src/billing/purchases";

/**
 * T074 billing SDK unit tests (plan step 4 + "Billing SDK unit" AC). Builds
 * a full mock native (configure/logIn/logOut + the 4 new paywall methods)
 * distinct from the T071 `purchases.test.ts` fixture, which intentionally
 * stays minimal/untouched.
 */
function makeMockNative(overrides: Partial<PurchasesNative> = {}): PurchasesNative {
  return {
    configure: jest.fn(),
    logIn: jest.fn(async () => ({})),
    logOut: jest.fn(async () => ({})),
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    getCustomerInfo: jest.fn(),
    ...overrides,
  };
}

function rcPackage(rcId: string, priceString: string, introPriceString?: string) {
  return {
    identifier: rcId,
    product: {
      priceString,
      introPrice: introPriceString ? { priceString: introPriceString } : null,
    },
  };
}

describe("fetchOfferings", () => {
  beforeEach(() => {
    __resetPurchasesForTest();
  });

  it("returns null when native is absent (Expo Go)", async () => {
    initPurchases({ loader: () => null });

    await expect(fetchOfferings()).resolves.toBeNull();
  });

  it("returns null when getOfferings is unsupported by the mock", async () => {
    const native: PurchasesNative = {
      configure: jest.fn(),
      logIn: jest.fn(async () => ({})),
      logOut: jest.fn(async () => ({})),
    };
    initPurchases({ loader: () => native, iosKey: "k", androidKey: "k" });

    await expect(fetchOfferings()).resolves.toBeNull();
  });

  it("returns null when offerings.current is missing", async () => {
    const native = makeMockNative({ getOfferings: jest.fn(async () => ({ current: null })) });
    initPurchases({ loader: () => native, iosKey: "k", androidKey: "k" });

    await expect(fetchOfferings()).resolves.toBeNull();
  });

  it("normalizes packages: id mapping + priceString + introPrice", async () => {
    const native = makeMockNative({
      getOfferings: jest.fn(async () => ({
        current: {
          availablePackages: [
            rcPackage(RC_PACKAGE_IDS.monthly, "$4.99/mo", "$0.00 for 7 days"),
            rcPackage(RC_PACKAGE_IDS.annual, "$39.99/yr"),
            rcPackage(RC_PACKAGE_IDS.family, "$59.99/yr"),
          ],
        },
      })),
    });
    initPurchases({ loader: () => native, iosKey: "k", androidKey: "k" });

    const offering = await fetchOfferings();

    expect(offering).not.toBeNull();
    expect(offering?.packages).toHaveLength(3);
    expect(offering?.packages.find((p) => p.id === "monthly")).toEqual({
      id: "monthly",
      priceString: "$4.99/mo",
      introPriceString: "$0.00 for 7 days",
      rcPackage: expect.objectContaining({ identifier: RC_PACKAGE_IDS.monthly }),
    });
    expect(offering?.packages.find((p) => p.id === "annual")?.introPriceString).toBeUndefined();
    expect(offering?.packages.find((p) => p.id === "family")?.priceString).toBe("$59.99/yr");
  });

  it("skips an unrecognized package identifier rather than fabricating an id", async () => {
    const native = makeMockNative({
      getOfferings: jest.fn(async () => ({
        current: { availablePackages: [rcPackage("$rc_weekly", "$1.99/wk")] },
      })),
    });
    initPurchases({ loader: () => native, iosKey: "k", androidKey: "k" });

    await expect(fetchOfferings()).resolves.toBeNull();
  });

  it("returns null when getOfferings rejects", async () => {
    const native = makeMockNative({ getOfferings: jest.fn(async () => Promise.reject(new Error("network"))) });
    initPurchases({ loader: () => native, iosKey: "k", androidKey: "k" });

    await expect(fetchOfferings()).resolves.toBeNull();
  });
});

describe("purchasePackage", () => {
  beforeEach(() => {
    __resetPurchasesForTest();
  });

  const pkg = { id: "monthly" as const, priceString: "$4.99/mo", rcPackage: { identifier: "$rc_monthly" } };

  it("resolves success with customerInfo", async () => {
    const customerInfo = { entitlements: { active: { [RC_ENTITLEMENT_ID]: {} } } };
    const native = makeMockNative({ purchasePackage: jest.fn(async () => ({ customerInfo })) });
    initPurchases({ loader: () => native, iosKey: "k", androidKey: "k" });

    await expect(purchasePackage(pkg)).resolves.toEqual({ status: "success", customerInfo });
  });

  it("maps a userCancelled error to cancelled", async () => {
    const native = makeMockNative({
      purchasePackage: jest.fn(async () => Promise.reject({ userCancelled: true })),
    });
    initPurchases({ loader: () => native, iosKey: "k", androidKey: "k" });

    await expect(purchasePackage(pkg)).resolves.toEqual({ status: "cancelled" });
  });

  it("maps a PAYMENT_PENDING_ERROR code to pending", async () => {
    const native = makeMockNative({
      purchasePackage: jest.fn(async () => Promise.reject({ code: "PAYMENT_PENDING_ERROR" })),
    });
    initPurchases({ loader: () => native, iosKey: "k", androidKey: "k" });

    await expect(purchasePackage(pkg)).resolves.toEqual({ status: "pending" });
  });

  it("maps any other error to error", async () => {
    const native = makeMockNative({
      purchasePackage: jest.fn(async () => Promise.reject(new Error("boom"))),
    });
    initPurchases({ loader: () => native, iosKey: "k", androidKey: "k" });

    await expect(purchasePackage(pkg)).resolves.toEqual({ status: "error" });
  });

  it("resolves error when native is absent (never rejects)", async () => {
    initPurchases({ loader: () => null });

    await expect(purchasePackage(pkg)).resolves.toEqual({ status: "error" });
  });
});

describe("restorePurchases", () => {
  beforeEach(() => {
    __resetPurchasesForTest();
  });

  it("resolves success+entitled:true when the restored customerInfo has the entitlement", async () => {
    const native = makeMockNative({
      restorePurchases: jest.fn(async () => ({ entitlements: { active: { [RC_ENTITLEMENT_ID]: {} } } })),
    });
    initPurchases({ loader: () => native, iosKey: "k", androidKey: "k" });

    await expect(restorePurchases()).resolves.toEqual({ status: "success", entitled: true });
  });

  it("resolves success+entitled:false (neutral, not an error) when there is no active entitlement", async () => {
    const native = makeMockNative({
      restorePurchases: jest.fn(async () => ({ entitlements: { active: {} } })),
    });
    initPurchases({ loader: () => native, iosKey: "k", androidKey: "k" });

    await expect(restorePurchases()).resolves.toEqual({ status: "success", entitled: false });
  });

  it("resolves error when the call rejects", async () => {
    const native = makeMockNative({ restorePurchases: jest.fn(async () => Promise.reject(new Error("boom"))) });
    initPurchases({ loader: () => native, iosKey: "k", androidKey: "k" });

    await expect(restorePurchases()).resolves.toEqual({ status: "error" });
  });

  it("resolves error when native is absent", async () => {
    initPurchases({ loader: () => null });

    await expect(restorePurchases()).resolves.toEqual({ status: "error" });
  });
});

describe("fetchCustomerInfo", () => {
  beforeEach(() => {
    __resetPurchasesForTest();
  });

  it("returns null when native is absent", async () => {
    initPurchases({ loader: () => null });

    await expect(fetchCustomerInfo()).resolves.toBeNull();
  });

  it("returns the raw customerInfo when native resolves", async () => {
    const customerInfo = { entitlements: { active: {} } };
    const native = makeMockNative({ getCustomerInfo: jest.fn(async () => customerInfo) });
    initPurchases({ loader: () => native, iosKey: "k", androidKey: "k" });

    await expect(fetchCustomerInfo()).resolves.toBe(customerInfo);
  });

  it("returns null when the call rejects", async () => {
    const native = makeMockNative({ getCustomerInfo: jest.fn(async () => Promise.reject(new Error("boom"))) });
    initPurchases({ loader: () => native, iosKey: "k", androidKey: "k" });

    await expect(fetchCustomerInfo()).resolves.toBeNull();
  });
});

describe("isEntitled", () => {
  it("is true when the active entitlements include RC_ENTITLEMENT_ID", () => {
    expect(isEntitled({ entitlements: { active: { [RC_ENTITLEMENT_ID]: {} } } })).toBe(true);
  });

  it("is false when the entitlement is absent", () => {
    expect(isEntitled({ entitlements: { active: {} } })).toBe(false);
  });

  it("is false for null/undefined/malformed customerInfo", () => {
    expect(isEntitled(null)).toBe(false);
    expect(isEntitled(undefined)).toBe(false);
    expect(isEntitled("not an object")).toBe(false);
  });
});
