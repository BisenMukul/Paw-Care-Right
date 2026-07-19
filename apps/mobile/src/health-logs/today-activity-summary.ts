import type { TimelineItem } from "../api/health-logs-api";

export interface TodayActivityCounts {
  food: number;
  water: number;
  walk: number;
  potty: number;
}

/** The subset of `TimelineItem` this pure aggregator needs (FIDELITY-1 plan). */
export type TodayActivitySummaryInput = Pick<TimelineItem, "kind" | "occurredAt" | "value">;

function isSameLocalDay(iso: string, now: Date): boolean {
  const occurred = new Date(iso);
  return (
    occurred.getFullYear() === now.getFullYear() &&
    occurred.getMonth() === now.getMonth() &&
    occurred.getDate() === now.getDate()
  );
}

/**
 * Client-side "Today" intake aggregation (FIDELITY-1 plan): counts only
 * `kind === "ACTIVITY"` items whose `occurredAt` falls on `now`'s local
 * calendar day, bucketed FOOD->food, WATER->water, WALK->walk, POTTY->potty.
 * SLEEP/PLAY/GROOMING and any other `activityType` are ignored (no
 * total/goal/kcal claim -- plan R5). Pure, deterministic given `now`.
 */
export function summarizeTodayActivity(
  items: TodayActivitySummaryInput[],
  now: Date,
): TodayActivityCounts {
  const counts: TodayActivityCounts = { food: 0, water: 0, walk: 0, potty: 0 };

  for (const item of items) {
    if (item.kind !== "ACTIVITY") {
      continue;
    }
    if (!isSameLocalDay(item.occurredAt, now)) {
      continue;
    }
    const activityType = item.value["activityType"];
    switch (activityType) {
      case "FOOD":
        counts.food += 1;
        break;
      case "WATER":
        counts.water += 1;
        break;
      case "WALK":
        counts.walk += 1;
        break;
      case "POTTY":
        counts.potty += 1;
        break;
      default:
        break;
    }
  }

  return counts;
}
