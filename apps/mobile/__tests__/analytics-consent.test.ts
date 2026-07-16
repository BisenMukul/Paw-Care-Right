import { useAuthStore } from "../src/auth/auth-store";

/**
 * AC "consent flag respected (default on, off switch)" (T078 plan) --
 * mobile half. `getConfig` is stubbed with a non-empty `posthogKey` (so the
 * REAL `createHttpTransport` -- not stub-no-op'd -- actually reaches
 * `fetch`); this exercises the REAL `createAnalytics` + REAL
 * `useConsentStore` end-to-end through `captureEvent`, proving the consent
 * gate actually reaches the transport (not just unit-tested in isolation in
 * `packages/analytics`).
 */
jest.mock("../src/config", () => ({
  getConfig: () => ({
    apiBaseUrl: "http://localhost:3000",
    googleClientId: "",
    revenueCatIosKey: "stub_ios_key",
    revenueCatAndroidKey: "stub_android_key",
    termsUrl: "https://pawcareright.app/terms",
    privacyUrl: "https://pawcareright.app/privacy",
    posthogKey: "phc_test_key",
    posthogHost: "https://us.i.posthog.com",
  }),
}));

import { captureEvent } from "../src/analytics/analytics";
import { useConsentStore } from "../src/analytics/consent-store";

describe("mobile captureEvent + analytics consent", () => {
  let fetchSpy: jest.Mock;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchSpy = jest.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    useConsentStore.setState({ enabled: true });
    useAuthStore.setState({ user: { id: "user-1", email: "user@example.com" } });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("consent enabled (default) -> the transport IS invoked", () => {
    expect(useConsentStore.getState().enabled).toBe(true);

    captureEvent("paywall_view", { source: "onboarding" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://us.i.posthog.com/capture/",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("setEnabled(false) -> the transport is NOT invoked", () => {
    useConsentStore.getState().setEnabled(false);

    captureEvent("paywall_view", { source: "onboarding" });

    expect(fetchSpy).not.toHaveBeenCalled();
    // Restore for other tests/files sharing this persisted MMKV-backed store.
    useConsentStore.getState().setEnabled(true);
  });

  it("no signed-in user -> captureEvent is a no-op regardless of consent", () => {
    useAuthStore.setState({ user: null });

    captureEvent("paywall_view", { source: "onboarding" });

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
