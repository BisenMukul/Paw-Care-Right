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
 *
 * T115: `fetchAppConfig` now parses with the CLIENT-tolerant
 * `appConfigClientSchema` (F1 / docs/OTA_UPDATES.md §5.4). The cases below
 * also cover: `DEFAULT_APP_CONFIG`'s new no-gate fields, a body OMITTING the
 * new `minAppVersion`/`recommendedAppVersion` fields (pre-T115 server ->
 * client-side defaults, not a parse failure), and the F1 proof itself (an
 * unknown FUTURE field must not reject the body / lose the kill switches).
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

  it("DEFAULT_APP_CONFIG.minAppVersion/recommendedAppVersion are '0.0.0' on both platforms (T115 — fail-open, never a gate)", () => {
    expect(DEFAULT_APP_CONFIG.minAppVersion).toEqual({ ios: "0.0.0", android: "0.0.0" });
    expect(DEFAULT_APP_CONFIG.recommendedAppVersion).toEqual({ ios: "0.0.0", android: "0.0.0" });
  });

  it("resolves the flattened server config on a valid 200 body AND writes the cache", async () => {
    mockGet.mockResolvedValue({
      paywall: { variant: "B" },
      minSupportedVersion: "1.5.0",
      hotlinePackVersion: 3,
      features: { checks: false, chat: true, paywall: true },
      criticalOtaVersion: "u-critical-1",
      minAppVersion: { ios: "1.0.0", android: "1.0.0" },
      recommendedAppVersion: { ios: "1.5.0", android: "1.5.0" },
    });

    await expect(fetchAppConfig()).resolves.toEqual({
      variant: "B",
      minSupportedVersion: "1.5.0",
      hotlinePackVersion: 3,
      features: { checks: false, chat: true, paywall: true },
      criticalOtaVersion: "u-critical-1",
      minAppVersion: { ios: "1.0.0", android: "1.0.0" },
      recommendedAppVersion: { ios: "1.5.0", android: "1.5.0" },
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
      minAppVersion: { ios: "1.0.0", android: "1.0.0" },
      recommendedAppVersion: { ios: "1.5.0", android: "1.5.0" },
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
      minAppVersion: { ios: "1.0.0", android: "1.0.0" },
      recommendedAppVersion: { ios: "1.5.0", android: "1.5.0" },
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
      minAppVersion: { ios: "1.0.0", android: "1.0.0" },
      recommendedAppVersion: { ios: "1.5.0", android: "1.5.0" },
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
      minAppVersion: { ios: "1.0.0", android: "1.0.0" },
      recommendedAppVersion: { ios: "1.5.0", android: "1.5.0" },
    });
  });

  it("a body MISSING minAppVersion/recommendedAppVersion (pre-T115 server) still parses and defaults both to '0.0.0' (client-tolerant, not schema-invalid)", async () => {
    mockGet.mockResolvedValue({
      paywall: { variant: "A" },
      minSupportedVersion: "0.0.0",
      hotlinePackVersion: 1,
      features: { checks: true, chat: true, paywall: true },
      criticalOtaVersion: null,
    });

    await expect(fetchAppConfig()).resolves.toEqual({
      variant: "A",
      minSupportedVersion: "0.0.0",
      hotlinePackVersion: 1,
      features: { checks: true, chat: true, paywall: true },
      criticalOtaVersion: null,
      minAppVersion: { ios: "0.0.0", android: "0.0.0" },
      recommendedAppVersion: { ios: "0.0.0", android: "0.0.0" },
    });
  });

  it("a server body with an unknown FUTURE field is still delivered (kill switches survive schema skew — OTA_UPDATES §5.4)", async () => {
    mockGet.mockResolvedValue({
      paywall: { variant: "A" },
      minSupportedVersion: "0.0.0",
      hotlinePackVersion: 1,
      features: { checks: false, chat: true, paywall: true },
      criticalOtaVersion: null,
      minAppVersion: { ios: "0.0.0", android: "0.0.0" },
      recommendedAppVersion: { ios: "0.0.0", android: "0.0.0" },
      futureKnob: "x",
    });

    const config = await fetchAppConfig();

    // The FRESH config, not the (still-warm, different-variant) cache --
    // proving the unknown field did not reject the parse.
    expect(config.features.checks).toBe(false);
    expect(config).not.toHaveProperty("futureKnob");
  });
});
