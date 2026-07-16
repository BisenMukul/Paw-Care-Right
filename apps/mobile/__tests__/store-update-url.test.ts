import { ANDROID_UPDATE_URL, IOS_UPDATE_URL, resolveStoreUpdateUrl } from "../src/config/store-update-url";

describe("resolveStoreUpdateUrl", () => {
  it("returns the Play Store URL for 'android'", () => {
    expect(resolveStoreUpdateUrl("android")).toBe(ANDROID_UPDATE_URL);
  });

  it("returns the iOS/provisional URL for 'ios'", () => {
    expect(resolveStoreUpdateUrl("ios")).toBe(IOS_UPDATE_URL);
  });

  it("returns the iOS/provisional URL for an unrecognized platform", () => {
    expect(resolveStoreUpdateUrl("web")).toBe(IOS_UPDATE_URL);
  });
});
