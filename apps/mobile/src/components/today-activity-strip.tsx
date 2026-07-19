import { ActivityIndicator, Text, View } from "react-native";

import { useHealthTimeline } from "../api/health-logs-api";
import { summarizeTodayActivity } from "../health-logs/today-activity-summary";
import { strings } from "../strings";

export interface TodayActivityStripProps {
  petId: string;
}

/**
 * "Today" intake strip (FIDELITY-1 plan, mockup FOOD screen reference
 * `docs/design/pawsaathi.dc.html` ~170): client-side aggregation of
 * `useHealthTimeline(petId, "ACTIVITY")`'s page-1 items (20 newest,
 * newest-first) filtered to the local calendar day, rendered as plain count
 * chips -- no total/goal/kcal (plan R5: the mockup's "/650 kcal" target is a
 * fabricated claim and is dropped; a count of logged-today entries is
 * truthful even as a page-1 floor). Never blocks the logger: loading and
 * empty both render a benign placeholder.
 */
export function TodayActivityStrip({ petId }: TodayActivityStripProps) {
  const { data, isLoading } = useHealthTimeline(petId, "ACTIVITY");

  if (isLoading) {
    return (
      <View
        testID="activity-today-strip"
        className="gap-2 rounded-2xl bg-white dark:bg-surface-card-dark px-4 py-3 shadow-md"
      >
        <ActivityIndicator testID="activity-today-strip-loading" />
      </View>
    );
  }

  const items = data?.pages[0]?.items ?? [];
  const counts = summarizeTodayActivity(items, new Date());

  const chips: string[] = [];
  if (counts.food > 0) {
    chips.push(strings.activity.today.meals(counts.food));
  }
  if (counts.water > 0) {
    chips.push(strings.activity.today.water(counts.water));
  }
  if (counts.walk > 0) {
    chips.push(strings.activity.today.walks(counts.walk));
  }
  if (counts.potty > 0) {
    chips.push(strings.activity.today.potty(counts.potty));
  }

  return (
    <View
      testID="activity-today-strip"
      className="gap-2 rounded-2xl bg-white dark:bg-surface-card-dark px-4 py-3 shadow-md"
    >
      <Text className="text-sm font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
        {strings.activity.today.title}
      </Text>
      {chips.length === 0 ? (
        <Text
          testID="activity-today-strip-empty"
          className="text-sm text-brand-700 dark:text-ink-muted-dark font-body"
        >
          {strings.activity.today.empty}
        </Text>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {chips.map((chip) => (
            <View
              key={chip}
              className="rounded-full bg-brand-50 dark:bg-surface-raised-dark px-3 py-1"
            >
              <Text className="text-xs font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
                {chip}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
