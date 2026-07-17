import { Pressable, ScrollView, Text, View } from "react-native";

import type { ActivityRecentEntry } from "../health-logs/activity-recents-store";
import { strings } from "../strings";

export interface ActivityRecentsRowProps {
  recents: ActivityRecentEntry[];
  onPress: (entry: ActivityRecentEntry) => void;
}

/** "Fed · 2 meals" style label for a single recent combo (record-only, CLAUDE §7). */
export function recentEntryLabel(entry: ActivityRecentEntry): string {
  const parts: string[] = [strings.activity.summaryVerb[entry.activityType]];

  if (entry.unit !== undefined) {
    const singular = strings.activity.unitLabelSingular[entry.unit];
    const label = entry.quantity === 1 && singular !== undefined ? singular : strings.activity.unitLabel[entry.unit];
    parts.push(entry.quantity !== undefined ? `${entry.quantity} ${label}` : label);
  } else if (entry.quantity !== undefined) {
    parts.push(String(entry.quantity));
  }

  return parts.join(" · ");
}

/**
 * Design-system §5.1.3's "recents row": the last (up to 3) distinct
 * (activityType, quantity, unit) combos, each a 1-tap repeat chip.
 * `onPress` is fired immediately (this component holds no undo/confirmation
 * state -- that lives in the screen per design-system §5.1.3's "delayed
 * save + undo" contract). Renders nothing when there are no recents yet.
 */
export function ActivityRecentsRow({ recents, onPress }: ActivityRecentsRowProps) {
  if (recents.length === 0) {
    return null;
  }

  return (
    <View testID="activity-recents-row" className="gap-2">
      <Text className="text-sm font-semibold text-brand-900">{strings.activity.recentsTitle}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">
          {recents.map((entry, index) => {
            const label = recentEntryLabel(entry);
            return (
              <Pressable
                key={`${entry.activityType}-${entry.quantity ?? "x"}-${entry.unit ?? "x"}-${index}`}
                testID={`activity-recent-chip-${index}`}
                accessibilityRole="button"
                accessibilityLabel={strings.activity.recentChipA11y(label)}
                onPress={() => onPress(entry)}
                className="rounded-full border border-brand-100 bg-white px-4 py-2.5"
              >
                <Text className="text-sm text-brand-900">{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
