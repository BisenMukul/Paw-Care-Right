import { memo } from "react";
import { Pressable, Text, View } from "react-native";

import type { TimelineItem } from "../api/health-logs-api";
import { getKindDisplay } from "../health-logs/kind-display";
import { extractCheckRefId, summarizeTimelineValue } from "../health-logs/timeline-value";
import { strings } from "../strings";
import { TimelinePhotoStrip } from "./timeline-photo-strip";

export interface TimelineRowProps {
  item: TimelineItem;
  petId: string;
  onPressCheck: (checkId: string) => void;
  onOpenPhoto: (args: { petId: string; photoKeys: string[]; index: number }) => void;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Device-local `YYYY-MM-DD` (T067 plan decision 7 -- NOT UTC/`toISOString`). */
function localDateKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * Presentational timeline row (T067 plan). `React.memo`'d so appending a
 * page never re-renders existing rows (the AC's render-count proof): as
 * long as `item` and `onPressCheck` keep the same references across a
 * parent re-render, React skips this component's body entirely --
 * `getKindDisplay` (called exactly once per actual render) is the spy target
 * the screen test uses to prove that.
 *
 * Only CHECK_REF rows with a well-formed `checkId` are pressable (T067 plan
 * decision 6); a malformed/absent value renders a plain, non-navigating row
 * -- no crash, and the destination result screen already fails upward on a
 * deleted check.
 */
export const TimelineRow = memo(function TimelineRow({ item, petId, onPressCheck, onOpenPhoto }: TimelineRowProps) {
  const display = getKindDisplay(item.kind);
  const date = localDateKey(item.occurredAt);
  const summary = summarizeTimelineValue(item);
  const checkId = item.kind === "CHECK_REF" ? extractCheckRefId(item) : null;

  const content = (
    <View className="flex-row gap-3 px-4 py-3">
      <View className="items-center">
        <View className={`h-9 w-9 items-center justify-center rounded-full ${display.colorClass}`}>
          <Text className="text-base">{display.icon}</Text>
        </View>
        <View className="mt-1 w-0.5 flex-1 bg-brand-200 dark:bg-hairline-dark" />
      </View>
      <View className="flex-1 gap-1 rounded-2xl border border-brand-100 dark:border-hairline-dark bg-white dark:bg-surface-card-dark p-3">
        <Text className="text-base font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
          {strings.timeline.kindLabel[item.kind]}
        </Text>
        <Text
          className="text-sm text-brand-700 dark:text-ink-muted-dark font-body"
          accessibilityLabel={strings.timeline.dateA11y(date)}
        >
          {date}
        </Text>
        {/* design-system.md §7.3 calls for `tabular-nums` here (this summary
            renders the WEIGHT kind's numeric grams value, e.g. "25000 g") --
            deferred: nativewind@4.2.6/react-native-css-interop@0.2.6 drop
            `font-variant-numeric` (absent from `validProperties`), so the
            class is a silent no-op on-device. Revisit once css-interop maps
            it, or route a real `fontVariant` utility through
            `packages/config` (follow-up task, not a per-screen fix). */}
        {summary !== null ? (
          <Text className="text-sm text-brand-900 dark:text-ink-dark font-body">{summary}</Text>
        ) : null}
      </View>
    </View>
  );

  // A separate, independently-memoized component (T069 plan decision 4) --
  // its query resolving re-renders only the strip, never this row's body.
  const photoStrip =
    item.photoKeys.length > 0 ? (
      <TimelinePhotoStrip
        petId={petId}
        entryId={item.id}
        photoKeys={item.photoKeys}
        kindLabel={strings.timeline.kindLabel[item.kind]}
        date={date}
        onOpenPhoto={onOpenPhoto}
      />
    ) : null;

  if (checkId !== null) {
    return (
      <Pressable testID={`timeline-row-${item.id}`} accessibilityRole="button" onPress={() => onPressCheck(checkId)}>
        {content}
        {photoStrip}
      </Pressable>
    );
  }

  return (
    <View testID={`timeline-row-${item.id}`}>
      {content}
      {photoStrip}
    </View>
  );
});
