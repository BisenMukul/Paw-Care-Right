import { HEALTH_LOG_KINDS, type HealthLogKind } from "@pawcareright/types";
import { ScrollView } from "react-native";

import { strings } from "../strings";
import { Chip } from "./chip";

export interface TimelineFilterChipsProps {
  value: HealthLogKind | null;
  onChange: (kind: HealthLogKind | null) => void;
}

/**
 * `TimelineFilterChips` (T067 plan decision 4): `[All, …HEALTH_LOG_KINDS]`.
 * These filter the ACTIVE pet's timeline by entry `kind` -- unlike
 * `PetFilterChips`, `value: null` here means "every kind", not "every pet"
 * (the timeline endpoint is strictly pet-scoped, so there is no pet
 * switcher in this tab). Canon `Chip` (design-system.md §2.5, SWEEP-4 batch 4).
 */
export function TimelineFilterChips({ value, onChange }: TimelineFilterChipsProps) {
  return (
    <ScrollView
      horizontal
      testID="timeline-filter-chips-scroll"
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2"
    >
      <Chip
        testID="timeline-filter-chip-all"
        label={strings.timeline.filterAll}
        selected={value === null}
        onPress={() => onChange(null)}
      />
      {HEALTH_LOG_KINDS.map((kind) => (
        <Chip
          key={kind}
          testID={`timeline-filter-chip-${kind}`}
          label={strings.timeline.kindLabel[kind]}
          selected={value === kind}
          onPress={() => onChange(kind)}
        />
      ))}
    </ScrollView>
  );
}
