import { apiClient } from "../src/api/client";
import { DEFAULT_APP_CONFIG, fetchAppConfig } from "../src/config/app-config-queries";

/**
 * T079 "stale-cache behavior offline tested" AC (grown by T106 for the
 * `features` kill-switch fields). Tests run in the declared order below
 * (Jest executes a single file's `it`s serially): the first proves the
 * cold-start "never fetched, no cache" default; the second warms the
 * MMKV-backed cache with a valid response; the third proves the
 * OFFLINE/stale-cache fallback reads that SAME cached value back; the
 * fourth proves a schema-invalid body also falls back to the (still warm)
 * cache rather than throwing; the fifth proves a body MISSING `features`
 * (e.g. a pre-T106 server) is likewise schema-invalid under the `.strict()`
 * schema and falls back the same way (T106 Risk 1).
 */
jest.mock("../src/api/client", () => ({
  apiClient: { get: jest.fn() },
}));

const mockGet = apiClient.get as jest.Mock;

describe("fetchAppConfig — stale-cache / offline behavior", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("resolves DEFAULT_APP_CONFIG when offline and no cache has ever been written", async () => {
    mockGet.mockRejectedValue(new Error("network down"));

    await expect(fetchAppConfig()).resolves.toEqual(DEFAULT_APP_CONFIG);
  });

  it("DEFAULT_APP_CONFIG has all three features true (T106 D10 — fail-open)", () => {
    expect(DEFAULT_APP_CONFIG.features).toEqual({ checks: true, chat: true, paywall: true });
  });

  it("DEFAULT_APP_CONFIG.criticalOtaVersion is null (T114 — fail-safe default is 'no critical update')", () => {
    expect(DEFAULT_APP_CONFIG.criticalOtaVersion).toBeNull();
  });

  it("resolves the flattened server config on a valid 200 body AND writes the cache", async () => {
    mockGet.mockResolvedValue({
      paywall: { variant: "B" },
      minSupportedVersion: "1.5.0",
      hotlinePackVersion: 3,
      features: { checks: false, chat: true, paywall: true },
      criticalOtaVersion: "u-critical-1",
    });

    await expect(fetchAppConfig()).resolves.toEqual({
      variant: "B",
      minSupportedVersion: "1.5.0",
      hotlinePackVersion: 3,
      features: { checks: false, chat: true, paywall: true },
      criticalOtaVersion: "u-critical-1",
    });
  });

  it("AC: resolves the CACHED config (not the default) when a later fetch fails (offline)", async () => {
    mockGet.mockRejectedValue(new Error("offline"));

    await expect(fetchAppConfig()).resolves.toEqual({
      variant: "B",
      minSupportedVersion: "1.5.0",
      hotlinePackVersion: 3,
      features: { checks: false, chat: true, paywall: true },
      criticalOtaVersion: "u-critical-1",
    });
  });

  it("resolves the cached config (not the default) on a schema-invalid body", async () => {
    mockGet.mockResolvedValue({ paywall: { variant: "not-a-real-variant" } });

    await expect(fetchAppConfig()).resolves.toEqual({
      variant: "B",
      minSupportedVersion: "1.5.0",
      hotlinePackVersion: 3,
      features: { checks: false, chat: true, paywall: true },
      criticalOtaVersion: "u-critical-1",
    });
  });

  it("a body missing `features` (pre-T106 server) is schema-invalid and falls back to the cache (T106)", async () => {
    mockGet.mockResolvedValue({
      paywall: { variant: "A" },
      minSupportedVersion: "0.0.0",
      hotlinePackVersion: 1,
      criticalOtaVersion: null,
    });

    await expect(fetchAppConfig()).resolves.toEqual({
      variant: "B",
      minSupportedVersion: "1.5.0",
      hotlinePackVersion: 3,
      features: { checks: false, chat: true, paywall: true },
      criticalOtaVersion: "u-critical-1",
    });
  });

  it("a body missing `criticalOtaVersion` (pre-T114 server) is schema-invalid and falls back to the cache (T114)", async () => {
    mockGet.mockResolvedValue({
      paywall: { variant: "A" },
      minSupportedVersion: "0.0.0",
      hotlinePackVersion: 1,
      features: { checks: true, chat: true, paywall: true },
    });

    await expect(fetchAppConfig()).resolves.toEqual({
      variant: "B",
      minSupportedVersion: "1.5.0",
      hotlinePackVersion: 3,
      features: { checks: false, chat: true, paywall: true },
      criticalOtaVersion: "u-critical-1",
    });
  });
});
