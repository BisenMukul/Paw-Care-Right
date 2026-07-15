import { HEALTH_LOG_KINDS, type HealthLogKind } from "@pawcareright/types";
import { ScrollView, Text } from "react-native";

import { strings } from "../strings";

export interface TimelineFilterChipsProps {
  value: HealthLogKind | null;
  onChange: (kind: HealthLogKind | null) => void;
}

const SELECTED_CLASS = "mr-2 rounded-full bg-brand-700 px-3 py-2 text-sm font-semibold text-white";
const UNSELECTED_CLASS = "mr-2 rounded-full border border-brand-100 px-3 py-2 text-sm text-brand-900";

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
      <Text
        testID="timeline-filter-chip-all"
        onPress={() => onChange(null)}
        className={value === null ? SELECTED_CLASS : UNSELECTED_CLASS}
      >
        {strings.timeline.filterAll}
      </Text>
      {HEALTH_LOG_KINDS.map((kind) => (
        <Text
          key={kind}
          testID={`timeline-filter-chip-${kind}`}
          onPress={() => onChange(kind)}
          className={value === kind ? SELECTED_CLASS : UNSELECTED_CLASS}
        >
          {strings.timeline.kindLabel[kind]}
        </Text>
      ))}
    </ScrollView>
  );
}
