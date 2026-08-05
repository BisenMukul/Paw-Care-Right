import { createMMKV } from "react-native-mmkv";

import {
  FOREGROUND_RECHECK_INTERVAL_MS,
  readLastCheckAt,
  shouldRecheck,
  writeLastCheckAt,
} from "../src/ota/update-throttle";

const LAST_CHECK_AT_KEY = "bombaypetcompany.ota-last-check-at";

describe("update-throttle: FOREGROUND_RECHECK_INTERVAL_MS", () => {
  it("is exactly 6 hours in milliseconds", () => {
    expect(FOREGROUND_RECHECK_INTERVAL_MS).toBe(21_600_000);
  });
});

describe("update-throttle: persistence (AC3)", () => {
  it("read returns null when nothing has been written", () => {
    expect(readLastCheckAt()).toBeNull();
  });

  it("persists the last-check timestamp across module reloads (MMKV round-trip)", () => {
    // `jest.resetModules()` is deliberately NOT used here: this repo's
    // shared `react-native-mmkv` jest mock (`jest.setup.ts`) creates its
    // backing `Map` inside the `jest.mock` factory closure, which itself
    // re-runs (and so loses all state) the moment the module registry is
    // reset -- verified empirically: a `jest.resetModules()` + re-`require`
    // version of this test read back `null`, not `t`, because it reset the
    // MOCK's storage, not just the throttle module. A real MMKV binding has
    // no such coupling (it's backed by native storage outside the JS module
    // cache), so that failure is a jest-mock artifact, not a real
    // persistence bug. The round-trip is instead proven the same way
    // `app-config-cache.test.ts` proves its own MMKV persistence: writing
    // via the module's own function, then reading the SAME underlying key
    // through a fresh, independently-obtained `createMMKV()` handle (not
    // the module-internal one) -- proving the value actually reached MMKV
    // storage rather than living in a private JS variable.
    const t = 1_700_000_000_000;
    writeLastCheckAt(t);

    const mmkv = createMMKV();
    expect(mmkv.getString(LAST_CHECK_AT_KEY)).toBe(String(t));
    expect(readLastCheckAt()).toBe(t);
  });

  it("returns null when the stored value is corrupt/non-numeric", () => {
    const mmkv = createMMKV();
    mmkv.set(LAST_CHECK_AT_KEY, "not-a-number");

    expect(readLastCheckAt()).toBeNull();
  });

  it("returns null when the stored value is a non-integer", () => {
    const mmkv = createMMKV();
    mmkv.set(LAST_CHECK_AT_KEY, "123.45");

    expect(readLastCheckAt()).toBeNull();
  });

  it("returns null when the stored value is negative", () => {
    const mmkv = createMMKV();
    mmkv.set(LAST_CHECK_AT_KEY, "-5");

    expect(readLastCheckAt()).toBeNull();
  });
});

describe("update-throttle: shouldRecheck honours the 6h window (AC3)", () => {
  it("is true when never checked (lastCheckAt === null)", () => {
    expect(shouldRecheck(1_000_000, null)).toBe(true);
  });

  it("is false just under the 6h window", () => {
    const now = 1_000_000_000;
    const lastCheckAt = now - (FOREGROUND_RECHECK_INTERVAL_MS - 1);
    expect(shouldRecheck(now, lastCheckAt)).toBe(false);
  });

  it("is true exactly at the 6h boundary", () => {
    const now = 1_000_000_000;
    const lastCheckAt = now - FOREGROUND_RECHECK_INTERVAL_MS;
    expect(shouldRecheck(now, lastCheckAt)).toBe(true);
  });

  it("is true past the 6h window", () => {
    const now = 1_000_000_000;
    const lastCheckAt = now - (FOREGROUND_RECHECK_INTERVAL_MS + 1);
    expect(shouldRecheck(now, lastCheckAt)).toBe(true);
  });

  it("is true when the clock has gone backwards (lastCheckAt > now) — must never permanently wedge", () => {
    expect(shouldRecheck(1_000_000, 2_000_000)).toBe(true);
  });
});
