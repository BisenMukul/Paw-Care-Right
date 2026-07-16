import { apiClient } from "../src/api/client";
import { DEFAULT_APP_CONFIG, fetchAppConfig } from "../src/config/app-config-queries";

/**
 * T079 "stale-cache behavior offline tested" AC. Tests run in the declared
 * order below (Jest executes a single file's `it`s serially): the first
 * proves the cold-start "never fetched, no cache" default; the second warms
 * the MMKV-backed cache with a valid response; the third proves the
 * OFFLINE/stale-cache fallback reads that SAME cached value back; the
 * fourth proves a schema-invalid body also falls back to the (still warm)
 * cache rather than throwing.
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

  it("resolves the flattened server config on a valid 200 body AND writes the cache", async () => {
    mockGet.mockResolvedValue({
      paywall: { variant: "B" },
      minSupportedVersion: "1.5.0",
      hotlinePackVersion: 3,
    });

    await expect(fetchAppConfig()).resolves.toEqual({
      variant: "B",
      minSupportedVersion: "1.5.0",
      hotlinePackVersion: 3,
    });
  });

  it("AC: resolves the CACHED config (not the default) when a later fetch fails (offline)", async () => {
    mockGet.mockRejectedValue(new Error("offline"));

    await expect(fetchAppConfig()).resolves.toEqual({
      variant: "B",
      minSupportedVersion: "1.5.0",
      hotlinePackVersion: 3,
    });
  });

  it("resolves the cached config (not the default) on a schema-invalid body", async () => {
    mockGet.mockResolvedValue({ paywall: { variant: "not-a-real-variant" } });

    await expect(fetchAppConfig()).resolves.toEqual({
      variant: "B",
      minSupportedVersion: "1.5.0",
      hotlinePackVersion: 3,
    });
  });
});
