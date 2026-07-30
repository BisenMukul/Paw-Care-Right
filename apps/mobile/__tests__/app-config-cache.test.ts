import { createMMKV } from "react-native-mmkv";

import { readCachedConfig, writeCachedConfig } from "../src/config/app-config-cache";
import type { AppConfig } from "../src/config/app-config-queries";

// MMKV persist/round-trip coverage, mirroring `active-pet-store.test.ts`'s
// direct use of the shared in-memory MMKV mock (`jest.setup.ts`).
const CACHE_KEY = "bombaypetcompany.app-config-cache";

describe("app-config-cache", () => {
  it("read returns null when nothing has been written", () => {
    expect(readCachedConfig()).toBeNull();
  });

  it("write then read round-trips the config, including features (T106) and criticalOtaVersion (T114)", () => {
    const config: AppConfig = {
      variant: "B",
      minSupportedVersion: "1.2.3",
      hotlinePackVersion: 4,
      features: { checks: false, chat: true, paywall: true },
      criticalOtaVersion: "u-critical-1",
    };

    writeCachedConfig(config);

    expect(readCachedConfig()).toEqual(config);
  });

  it("returns null when the stored value is corrupt (not valid JSON)", () => {
    const mmkv = createMMKV();
    mmkv.set(CACHE_KEY, "{not-json");

    expect(readCachedConfig()).toBeNull();
  });

  it("returns null when the stored JSON is valid but schema-invalid", () => {
    const mmkv = createMMKV();
    mmkv.set(
      CACHE_KEY,
      JSON.stringify({
        variant: "Z",
        minSupportedVersion: 5,
        hotlinePackVersion: -1,
        features: { checks: true, chat: true, paywall: true },
        criticalOtaVersion: null,
      }),
    );

    expect(readCachedConfig()).toBeNull();
  });

  it("returns null for a legacy blob missing `features` entirely (T106 — treated as no cache, fail-open)", () => {
    const mmkv = createMMKV();
    mmkv.set(
      CACHE_KEY,
      JSON.stringify({ variant: "B", minSupportedVersion: "1.2.3", hotlinePackVersion: 4 }),
    );

    expect(readCachedConfig()).toBeNull();
  });

  it("returns null when a feature flag is non-boolean (T106)", () => {
    const mmkv = createMMKV();
    mmkv.set(
      CACHE_KEY,
      JSON.stringify({
        variant: "B",
        minSupportedVersion: "1.2.3",
        hotlinePackVersion: 4,
        features: { checks: "on", chat: true, paywall: true },
        criticalOtaVersion: null,
      }),
    );

    expect(readCachedConfig()).toBeNull();
  });

  it("returns null for a legacy blob missing criticalOtaVersion (T114)", () => {
    const mmkv = createMMKV();
    mmkv.set(
      CACHE_KEY,
      JSON.stringify({
        variant: "B",
        minSupportedVersion: "1.2.3",
        hotlinePackVersion: 4,
        features: { checks: false, chat: true, paywall: true },
      }),
    );

    expect(readCachedConfig()).toBeNull();
  });

  it("returns null when criticalOtaVersion is a non-string/non-null value", () => {
    const mmkv = createMMKV();
    mmkv.set(
      CACHE_KEY,
      JSON.stringify({
        variant: "B",
        minSupportedVersion: "1.2.3",
        hotlinePackVersion: 4,
        features: { checks: false, chat: true, paywall: true },
        criticalOtaVersion: 5,
      }),
    );

    expect(readCachedConfig()).toBeNull();
  });
});
