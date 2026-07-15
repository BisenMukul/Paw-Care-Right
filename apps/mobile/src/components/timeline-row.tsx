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
    <View className={`flex-row items-start gap-3 rounded-lg px-4 py-3 ${display.colorClass}`}>
      <Text className="text-xl">{display.icon}</Text>
      <View className="flex-1 gap-1">
        <Text className="text-base font-semibold text-brand-900">{strings.timeline.kindLabel[item.kind]}</Text>
        <Text className="text-sm text-brand-700" accessibilityLabel={strings.timeline.dateA11y(date)}>
          {date}
        </Text>
        {summary !== null ? <Text className="text-sm text-brand-900">{summary}</Text> : null}
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
