import * as Linking from "expo-linking";

import {
  ANDROID_MANAGE_SUBSCRIPTION_URL,
  IOS_MANAGE_SUBSCRIPTION_URL,
  openManageSubscription,
  resolveManageSubscriptionUrl,
} from "../src/billing/manage-subscription";
import { __resetPurchasesForTest, initPurchases, managementUrlFromCustomerInfo } from "../src/billing/purchases";

jest.mock("expo-linking", () => ({
  openURL: jest.fn(),
}));

const mockOpenURL = Linking.openURL as jest.Mock;

describe("resolveManageSubscriptionUrl", () => {
  it("returns the managementURL when present, regardless of platform", () => {
    expect(resolveManageSubscriptionUrl("rc://manage", "ios")).toBe("rc://manage");
    expect(resolveManageSubscriptionUrl("rc://manage", "android")).toBe("rc://manage");
  });

  it("falls back to the iOS store URL when managementURL is null", () => {
    expect(resolveManageSubscriptionUrl(null, "ios")).toBe(IOS_MANAGE_SUBSCRIPTION_URL);
  });

  it("falls back to the Android store URL (scoped to our package) when managementURL is null", () => {
    const url = resolveManageSubscriptionUrl(null, "android");
    expect(url).toBe(ANDROID_MANAGE_SUBSCRIPTION_URL);
    expect(url).toContain("package=com.pawcareright.app");
  });

  it("falls back to iOS for an unrecognized platform", () => {
    expect(resolveManageSubscriptionUrl(null, "web")).toBe(IOS_MANAGE_SUBSCRIPTION_URL);
  });

  it("falls back when managementURL is an empty string", () => {
    expect(resolveManageSubscriptionUrl("", "ios")).toBe(IOS_MANAGE_SUBSCRIPTION_URL);
  });
});

describe("managementUrlFromCustomerInfo", () => {
  it("returns the string managementURL when present", () => {
    expect(managementUrlFromCustomerInfo({ managementURL: "x" })).toBe("x");
  });

  it("returns null for an empty object", () => {
    expect(managementUrlFromCustomerInfo({})).toBeNull();
  });

  it("returns null for null", () => {
    expect(managementUrlFromCustomerInfo(null)).toBeNull();
  });

  it("returns null for a non-object", () => {
    expect(managementUrlFromCustomerInfo("nope")).toBeNull();
  });
});

describe("openManageSubscription", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetPurchasesForTest();
  });

  it("opens the managementURL when fetchCustomerInfo resolves one", async () => {
    initPurchases({
      loader: () => ({
        configure: jest.fn(),
        logIn: jest.fn(),
        logOut: jest.fn(),
        getCustomerInfo: jest.fn().mockResolvedValue({ managementURL: "rc://manage-me" }),
      }),
      iosKey: "appl_test_ios_key",
      androidKey: "goog_test_android_key",
      platformOS: "ios",
    });

    await openManageSubscription("ios");

    expect(mockOpenURL).toHaveBeenCalledWith("rc://manage-me");
  });

  it("opens the platform fallback for the given platformOS when managementURL is absent", async () => {
    initPurchases({
      loader: () => ({
        configure: jest.fn(),
        logIn: jest.fn(),
        logOut: jest.fn(),
        getCustomerInfo: jest.fn().mockResolvedValue({}),
      }),
      iosKey: "appl_test_ios_key",
      androidKey: "goog_test_android_key",
      platformOS: "android",
    });

    await openManageSubscription("android");

    expect(mockOpenURL).toHaveBeenCalledWith(ANDROID_MANAGE_SUBSCRIPTION_URL);
  });

  it("opens the iOS fallback when the native module is absent (Expo Go)", async () => {
    await openManageSubscription("ios");

    expect(mockOpenURL).toHaveBeenCalledWith(IOS_MANAGE_SUBSCRIPTION_URL);
  });

  it("never throws when Linking.openURL rejects", async () => {
    mockOpenURL.mockRejectedValueOnce(new Error("no handler"));

    await expect(openManageSubscription("ios")).resolves.toBeUndefined();
  });
});
