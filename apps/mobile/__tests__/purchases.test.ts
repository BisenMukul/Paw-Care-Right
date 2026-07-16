import { PRODUCT_IDS, RC_ENTITLEMENT_ID, RC_OFFERING_ID, RC_PACKAGE_IDS } from "../src/billing/products";
import {
  __resetPurchasesForTest,
  identifyPurchaser,
  initPurchases,
  isPurchasesConfigured,
  resetPurchaser,
  type PurchasesNative,
} from "../src/billing/purchases";

function makeMockNative(): PurchasesNative & {
  configure: jest.Mock;
  logIn: jest.Mock;
  logOut: jest.Mock;
} {
  return {
    configure: jest.fn(),
    logIn: jest.fn(async () => ({})),
    logOut: jest.fn(async () => ({})),
  };
}

describe("initPurchases", () => {
  beforeEach(() => {
    __resetPurchasesForTest();
  });

  it("configures once with the stub key + anonymous appUserID", () => {
    const native = makeMockNative();
    const result = initPurchases({
      loader: () => native,
      iosKey: "stub_ios_key",
      androidKey: "stub_android_key",
      platformOS: "ios",
    });

    expect(result).toBe(true);
    expect(native.configure).toHaveBeenCalledTimes(1);
    expect(native.configure).toHaveBeenCalledWith({ apiKey: "stub_ios_key", appUserID: null });
    expect(isPurchasesConfigured()).toBe(true);
  });

  it("picks the android key when platformOS is android", () => {
    const native = makeMockNative();
    initPurchases({
      loader: () => native,
      iosKey: "stub_ios_key",
      androidKey: "stub_android_key",
      platformOS: "android",
    });

    expect(native.configure).toHaveBeenCalledWith({ apiKey: "stub_android_key", appUserID: null });
  });

  it("is idempotent (no double-configure)", () => {
    const native = makeMockNative();
    const loader = jest.fn(() => native);

    initPurchases({ loader, iosKey: "stub_ios_key", androidKey: "stub_android_key", platformOS: "ios" });
    const second = initPurchases({
      loader,
      iosKey: "stub_ios_key",
      androidKey: "stub_android_key",
      platformOS: "ios",
    });

    expect(second).toBe(true);
    expect(native.configure).toHaveBeenCalledTimes(1);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("no-ops gracefully when the native module is absent (Expo Go)", () => {
    const result = initPurchases({ loader: () => null, platformOS: "ios" });

    expect(result).toBe(false);
    expect(isPurchasesConfigured()).toBe(false);
  });
});

describe("identifyPurchaser / resetPurchaser", () => {
  beforeEach(() => {
    __resetPurchasesForTest();
  });

  it("calls logIn(userId) once and dedups repeated identical calls", async () => {
    const native = makeMockNative();
    initPurchases({ loader: () => native, iosKey: "k", androidKey: "k", platformOS: "ios" });

    await identifyPurchaser("u1");
    expect(native.logIn).toHaveBeenCalledTimes(1);
    expect(native.logIn).toHaveBeenCalledWith("u1");

    await identifyPurchaser("u1");
    expect(native.logIn).toHaveBeenCalledTimes(1);

    await identifyPurchaser("u2");
    expect(native.logIn).toHaveBeenCalledTimes(2);
    expect(native.logIn).toHaveBeenLastCalledWith("u2");
  });

  it("resetPurchaser calls logOut and no-ops when already anonymous", async () => {
    const native = makeMockNative();
    initPurchases({ loader: () => native, iosKey: "k", androidKey: "k", platformOS: "ios" });

    await identifyPurchaser("u1");
    await resetPurchaser();
    expect(native.logOut).toHaveBeenCalledTimes(1);

    await resetPurchaser();
    expect(native.logOut).toHaveBeenCalledTimes(1);
  });

  it("identify/reset are no-ops before configure or when native absent", async () => {
    await identifyPurchaser("u1");
    await resetPurchaser();

    initPurchases({ loader: () => null, platformOS: "ios" });
    await identifyPurchaser("u1");
    await resetPurchaser();

    expect(isPurchasesConfigured()).toBe(false);
  });
});

// Mirrors the "Fixed identifiers table" in `docs/store-setup.md` §2 verbatim.
// `apps/mobile` has no Node `fs`/`@types/node` access (React Native/Metro
// runtime, not a Node backend, and adding `@types/node` would be an
// unjustified new dependency per CLAUDE.md §2 rule 7) — so this test pins
// `products.ts` against a literal transcription of that table instead of
// reading the file. If either this test or the doc's §2 table changes
// without the other, they now visibly disagree — the §1a drift guard the
// plan calls for.
const DOCUMENTED_STORE_SETUP = {
  entitlementId: "plus",
  offeringId: "default",
  productIds: {
    monthly: "pawcareright_monthly",
    annual: "pawcareright_annual",
    family: "pawcareright_family_annual",
  },
  packageIds: { monthly: "$rc_monthly", annual: "$rc_annual", family: "family" },
} as const;

describe("product-id constants vs docs/store-setup.md §2", () => {
  it("PRODUCT_IDS, RC_ENTITLEMENT_ID, RC_OFFERING_ID, RC_PACKAGE_IDS match the documented conventions", () => {
    expect(RC_ENTITLEMENT_ID).toBe(DOCUMENTED_STORE_SETUP.entitlementId);
    expect(RC_OFFERING_ID).toBe(DOCUMENTED_STORE_SETUP.offeringId);
    expect(PRODUCT_IDS).toEqual(DOCUMENTED_STORE_SETUP.productIds);
    expect(RC_PACKAGE_IDS).toEqual(DOCUMENTED_STORE_SETUP.packageIds);
  });
});
