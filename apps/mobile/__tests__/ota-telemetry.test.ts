import { createMMKV } from "react-native-mmkv";

import {
  clearPendingApplied,
  computeAppliedEvent,
  PENDING_MAX_AGE_MS,
  readPendingApplied,
  writePendingApplied,
} from "../src/ota/ota-telemetry";

const PENDING_APPLIED_KEY = "bombaypetcompany.ota-pending-applied";

/**
 * T117 step 10: round-trip + every `computeAppliedEvent` decision branch
 * (D2). `update-throttle.test.ts` idiom: `jest.setup.ts`'s shared
 * `react-native-mmkv` mock backs a single in-memory `Map` for the whole
 * test file, so a directly-obtained `createMMKV()` handle can poison the
 * SAME underlying storage `ota-telemetry.ts`'s own `createSafeStorage`
 * reads from.
 */
describe("ota-telemetry: writePendingApplied / readPendingApplied / clearPendingApplied", () => {
  afterEach(() => {
    clearPendingApplied();
  });

  it("round-trips a written record", () => {
    writePendingApplied({ fromUpdateId: "update-1", downloadedAtMs: 1000 });

    expect(readPendingApplied()).toEqual({ fromUpdateId: "update-1", downloadedAtMs: 1000 });
  });

  it("round-trips a null fromUpdateId (embedded launch)", () => {
    writePendingApplied({ fromUpdateId: null, downloadedAtMs: 500 });

    expect(readPendingApplied()).toEqual({ fromUpdateId: null, downloadedAtMs: 500 });
  });

  it("no record written -> null", () => {
    expect(readPendingApplied()).toBeNull();
  });

  it("clearPendingApplied removes the record", () => {
    writePendingApplied({ fromUpdateId: "update-1", downloadedAtMs: 1000 });
    clearPendingApplied();

    expect(readPendingApplied()).toBeNull();
  });

  it("a poisoned (non-JSON) stored value reads back as null, never throws", () => {
    const mmkv = createMMKV();
    mmkv.set(PENDING_APPLIED_KEY, "not json{{{");

    expect(() => readPendingApplied()).not.toThrow();
    expect(readPendingApplied()).toBeNull();
  });

  it("a structurally-invalid parsed value (wrong shape) reads back as null", () => {
    const mmkv = createMMKV();
    mmkv.set(PENDING_APPLIED_KEY, JSON.stringify({ fromUpdateId: 42, downloadedAtMs: "not-a-number" }));

    expect(readPendingApplied()).toBeNull();
  });

  it("a negative downloadedAtMs reads back as null", () => {
    const mmkv = createMMKV();
    mmkv.set(PENDING_APPLIED_KEY, JSON.stringify({ fromUpdateId: "update-1", downloadedAtMs: -5 }));

    expect(readPendingApplied()).toBeNull();
  });
});

describe("ota-telemetry: computeAppliedEvent (D2 pure decision function)", () => {
  it("returns null when there is no pending record", () => {
    expect(computeAppliedEvent({ current: "update-2", pending: null, nowMs: 1000 })).toBeNull();
  });

  it("returns null when current equals the pending fromUpdateId (nothing actually applied)", () => {
    expect(
      computeAppliedEvent({
        current: "update-1",
        pending: { fromUpdateId: "update-1", downloadedAtMs: 500 },
        nowMs: 1000,
      }),
    ).toBeNull();
  });

  it("returns null when the record is older than PENDING_MAX_AGE_MS", () => {
    expect(
      computeAppliedEvent({
        current: "update-2",
        pending: { fromUpdateId: "update-1", downloadedAtMs: 0 },
        nowMs: PENDING_MAX_AGE_MS + 1,
      }),
    ).toBeNull();
  });

  it("returns the applied event with latencyMs when a real apply is detected", () => {
    expect(
      computeAppliedEvent({
        current: "update-2",
        pending: { fromUpdateId: "update-1", downloadedAtMs: 1000 },
        nowMs: 1500,
      }),
    ).toEqual({ updateId: "update-2", fromUpdateId: "update-1", latencyMs: 500 });
  });

  it("clamps latencyMs to >= 0 on a backwards clock", () => {
    expect(
      computeAppliedEvent({
        current: "update-2",
        pending: { fromUpdateId: "update-1", downloadedAtMs: 1000 },
        nowMs: 500,
      }),
    ).toEqual({ updateId: "update-2", fromUpdateId: "update-1", latencyMs: 0 });
  });

  it("treats exactly PENDING_MAX_AGE_MS old (not yet over) as still valid", () => {
    expect(
      computeAppliedEvent({
        current: "update-2",
        pending: { fromUpdateId: "update-1", downloadedAtMs: 0 },
        nowMs: PENDING_MAX_AGE_MS,
      }),
    ).toEqual({ updateId: "update-2", fromUpdateId: "update-1", latencyMs: PENDING_MAX_AGE_MS });
  });
});
