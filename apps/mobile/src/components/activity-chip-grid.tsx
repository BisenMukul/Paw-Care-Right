import { Ionicons } from "@expo/vector-icons";
import type { ActivityType } from "@pawcareright/types";
import { Pressable, Text, View } from "react-native";

import { ACTIVITY_TYPE_CONFIG, ACTIVITY_TYPES_ORDER } from "../health-logs/activity-config";
import { strings } from "../strings";

export interface ActivityChipGridProps {
  onSelect: (activityType: ActivityType) => void;
}

/**
 * Tap 1 of the tap-first activity logger (design-system §5.1): a grid of
 * the 7 activity-type tiles. Tapping one opens the quantity sheet
 * (`ActivityQuantitySheet`) pre-filled with that type's smart default --
 * this component only reports the selection, it holds no state of its own.
 * Each tile is a `Pressable` at generous `py-5` padding (>=44pt effective
 * target, design-system §4.1).
 */
export function ActivityChipGrid({ onSelect }: ActivityChipGridProps) {
  return (
    <View testID="activity-chip-grid" className="flex-row flex-wrap gap-3">
      {ACTIVITY_TYPES_ORDER.map((activityType) => {
        const config = ACTIVITY_TYPE_CONFIG[activityType];
        const label = strings.activity.typeLabel[activityType];
        return (
          <Pressable
            key={activityType}
            testID={`activity-chip-${activityType}`}
            onPress={() => onSelect(activityType)}
            accessibilityRole="button"
            accessibilityLabel={strings.activity.typeChipA11y(label)}
            style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
            className="min-w-[28%] flex-1 basis-[28%] items-center gap-2 rounded-2xl bg-brand-50 px-3 py-5"
          >
            <Ionicons name={config.icon} size={26} color="#1f6350" />
            <Text className="text-center text-sm font-semibold text-brand-900">{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
