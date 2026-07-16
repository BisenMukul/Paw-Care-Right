import { apiClient } from "../src/api/client";
import { DEFAULT_PAYWALL_CONFIG, fetchPaywallConfig } from "../src/billing/paywall-queries";

/**
 * T074 "copy/variant from /config" AC + offline-safe-default (plan Risk 6).
 * Grown by T079: `fetchPaywallConfig` now delegates to the shared
 * `fetchAppConfig()` (one network call/cache backs both), so the mocked
 * bodies carry the full three-field `AppConfig` response shape. The
 * offline/malformed/missing-field cases run BEFORE the valid-body case so
 * they exercise the "no cache written yet" default path, since a
 * successful fetch now has the side effect of warming the shared MMKV
 * cache (see `app-config-queries.test.ts` for the cache-fallback AC itself).
 */
jest.mock("../src/api/client", () => ({
  apiClient: { get: jest.fn() },
}));

const mockGet = apiClient.get as jest.Mock;

describe("fetchPaywallConfig", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("resolves the default variant A on a fetch rejection (offline, no cache yet)", async () => {
    mockGet.mockRejectedValue(new Error("network down"));

    await expect(fetchPaywallConfig()).resolves.toEqual(DEFAULT_PAYWALL_CONFIG);
  });

  it("resolves the default variant A on a malformed/schema-invalid body", async () => {
    mockGet.mockResolvedValue({
      paywall: { variant: "not-a-real-variant" },
      minSupportedVersion: "0.0.0",
      hotlinePackVersion: 1,
    });

    await expect(fetchPaywallConfig()).resolves.toEqual(DEFAULT_PAYWALL_CONFIG);
  });

  it("resolves the default variant A on a body missing the paywall field", async () => {
    mockGet.mockResolvedValue({});

    await expect(fetchPaywallConfig()).resolves.toEqual(DEFAULT_PAYWALL_CONFIG);
  });

  it("resolves the server variant on a valid 200 body", async () => {
    mockGet.mockResolvedValue({
      paywall: { variant: "B" },
      minSupportedVersion: "0.0.0",
      hotlinePackVersion: 1,
    });

    await expect(fetchPaywallConfig()).resolves.toEqual({ variant: "B" });
  });
});
