import { COST_DAILY_KEY_PREFIX, QUOTA_KEY_PREFIX } from "./quota.constants";
import { costDailyKey, quotaKey, resolveLimit, windowBucket } from "./quota.util";

describe("windowBucket", () => {
  const NOW = new Date("2026-01-05T23:30:00Z");

  it("formats the day bucket as UTC YYYY-MM-DD, zero-padded", () => {
    expect(windowBucket("day", NOW)).toBe("2026-01-05");
  });

  it("formats the month bucket as UTC YYYY-MM, zero-padded", () => {
    expect(windowBucket("month", NOW)).toBe("2026-01");
  });

  it("returns 'all' for the total window", () => {
    expect(windowBucket("total", NOW)).toBe("all");
  });

  it("zero-pads single-digit months and days", () => {
    const earlyInMonth = new Date("2026-03-02T00:00:00Z");
    expect(windowBucket("day", earlyInMonth)).toBe("2026-03-02");
    expect(windowBucket("month", earlyInMonth)).toBe("2026-03");
  });
});

describe("quotaKey", () => {
  it("produces the exact documented key shape", () => {
    const now = new Date("2026-07-12T10:00:00Z");
    expect(quotaKey("foodLookups", "day", "u1", now)).toBe(
      `${QUOTA_KEY_PREFIX}foodLookups:day:u1:2026-07-12`,
    );
    expect(quotaKey("checks", "total", "u1", now)).toBe(`${QUOTA_KEY_PREFIX}checks:total:u1:all`);
    expect(quotaKey("checks", "month", "u1", now)).toBe(`${QUOTA_KEY_PREFIX}checks:month:u1:2026-07`);
  });
});

describe("costDailyKey", () => {
  it("produces the exact documented key shape", () => {
    const now = new Date("2026-07-12T10:00:00Z");
    expect(costDailyKey(now)).toBe(`${COST_DAILY_KEY_PREFIX}2026-07-12`);
  });
});

describe("resolveLimit", () => {
  it("returns the SPEC-verbatim limits for all four tier x metric pairs", () => {
    expect(resolveLimit("FREE", "checks")).toEqual({ window: "total", limit: 1 });
    expect(resolveLimit("FREE", "foodLookups")).toEqual({ window: "day", limit: 5 });
    expect(resolveLimit("PREMIUM", "checks")).toEqual({ window: "month", limit: 30 });
    expect(resolveLimit("PREMIUM", "foodLookups")).toEqual({ window: "day", limit: null });
  });
});
