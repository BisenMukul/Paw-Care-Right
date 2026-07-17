import { HEALTH_LOG_KINDS, type HealthLogKind } from "@pawcareright/types";
import { Pressable, ScrollView, Text } from "react-native";

import { strings } from "../strings";

export interface TimelineFilterChipsProps {
  value: HealthLogKind | null;
  onChange: (kind: HealthLogKind | null) => void;
}

// Touch-target-only fix (design-system.md §4.1): the bare `Text onPress`
// chip is a ~33pt tall tap target -- wrapping in a `Pressable` with
// `min-h-[44px]` reaches the WCAG/HIG floor without restyling colors
// (full `Chip` canon extraction is deferred to batch 4).
const CONTAINER_SELECTED = "mr-2 min-h-[44px] justify-center rounded-full bg-brand-700 px-3";
const CONTAINER_UNSELECTED = "mr-2 min-h-[44px] justify-center rounded-full border border-brand-100 px-3";
const TEXT_SELECTED = "text-sm font-semibold text-white";
const TEXT_UNSELECTED = "text-sm text-brand-900";

/**
 * `TimelineFilterChips` (T067 plan decision 4): `[All, …HEALTH_LOG_KINDS]`.
 * These filter the ACTIVE pet's timeline by entry `kind` -- unlike
 * `PetFilterChips`, `value: null` here means "every kind", not "every pet"
 * (the timeline endpoint is strictly pet-scoped, so there is no pet
 * switcher in this tab).
 */
export function TimelineFilterChips({ value, onChange }: TimelineFilterChipsProps) {
  return (
    <ScrollView horizontal testID="timeline-filter-chips-scroll" showsHorizontalScrollIndicator={false}>
      <Pressable
        testID="timeline-filter-chip-all"
        onPress={() => onChange(null)}
        accessibilityRole="button"
        accessibilityState={{ selected: value === null }}
        className={value === null ? CONTAINER_SELECTED : CONTAINER_UNSELECTED}
      >
        <Text className={value === null ? TEXT_SELECTED : TEXT_UNSELECTED}>{strings.timeline.filterAll}</Text>
      </Pressable>
      {HEALTH_LOG_KINDS.map((kind) => (
        <Pressable
          key={kind}
          testID={`timeline-filter-chip-${kind}`}
          onPress={() => onChange(kind)}
          accessibilityRole="button"
          accessibilityState={{ selected: value === kind }}
          className={value === kind ? CONTAINER_SELECTED : CONTAINER_UNSELECTED}
        >
          <Text className={value === kind ? TEXT_SELECTED : TEXT_UNSELECTED}>
            {strings.timeline.kindLabel[kind]}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
