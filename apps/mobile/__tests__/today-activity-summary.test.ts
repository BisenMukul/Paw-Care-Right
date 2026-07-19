import type { TodayActivitySummaryInput } from "../src/health-logs/today-activity-summary";
import { summarizeTodayActivity } from "../src/health-logs/today-activity-summary";

const NOW = new Date("2026-01-15T18:00:00.000Z");

function activityItem(activityType: string, occurredAt: string): TodayActivitySummaryInput {
  return { kind: "ACTIVITY", occurredAt, value: { activityType } };
}

describe("summarizeTodayActivity — no data", () => {
  it("empty items -> all zeros", () => {
    expect(summarizeTodayActivity([], NOW)).toEqual({ food: 0, water: 0, walk: 0, potty: 0 });
  });
});

describe("summarizeTodayActivity — partial", () => {
  it("counts only today's FOOD/WALK, excludes yesterday and non-tracked types", () => {
    const items: TodayActivitySummaryInput[] = [
      activityItem("FOOD", "2026-01-15T08:00:00.000Z"),
      activityItem("WALK", "2026-01-15T12:00:00.000Z"),
      activityItem("SLEEP", "2026-01-15T02:00:00.000Z"), // today, but not a tracked bucket
      activityItem("FOOD", "2026-01-14T08:00:00.000Z"), // yesterday: excluded
    ];
    expect(summarizeTodayActivity(items, NOW)).toEqual({ food: 1, water: 0, walk: 1, potty: 0 });
  });

  it("ignores non-ACTIVITY kinds even if occurredAt is today", () => {
    const items: TodayActivitySummaryInput[] = [
      { kind: "NOTE", occurredAt: "2026-01-15T08:00:00.000Z", value: { text: "hi" } },
    ];
    expect(summarizeTodayActivity(items, NOW)).toEqual({ food: 0, water: 0, walk: 0, potty: 0 });
  });
});

describe("summarizeTodayActivity — all categories present today", () => {
  it("each tracked count is >= 1", () => {
    const items: TodayActivitySummaryInput[] = [
      activityItem("FOOD", "2026-01-15T06:00:00.000Z"),
      activityItem("WATER", "2026-01-15T07:00:00.000Z"),
      activityItem("WALK", "2026-01-15T09:00:00.000Z"),
      activityItem("POTTY", "2026-01-15T10:00:00.000Z"),
    ];
    const result = summarizeTodayActivity(items, NOW);
    expect(result.food).toBeGreaterThanOrEqual(1);
    expect(result.water).toBeGreaterThanOrEqual(1);
    expect(result.walk).toBeGreaterThanOrEqual(1);
    expect(result.potty).toBeGreaterThanOrEqual(1);
  });
});

describe("summarizeTodayActivity — determinism", () => {
  it("identical items + now yields identical output", () => {
    const items: TodayActivitySummaryInput[] = [activityItem("FOOD", "2026-01-15T06:00:00.000Z")];
    const first = summarizeTodayActivity(items, NOW);
    const second = summarizeTodayActivity(items, new Date(NOW.getTime()));
    expect(first).toEqual(second);
  });
});
