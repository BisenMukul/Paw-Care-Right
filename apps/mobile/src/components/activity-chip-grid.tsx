import { Ionicons } from "@expo/vector-icons";
import type { ActivityType } from "@pawcareright/types";
import { Pressable, Text, View } from "react-native";

import { ACTIVITY_TYPE_CONFIG, ACTIVITY_TYPES_ORDER } from "../health-logs/activity-config";
import { useLayoutBucket } from "../hooks/use-layout-bucket";
import { strings } from "../strings";

export interface ActivityChipGridProps {
  onSelect: (activityType: ActivityType) => void;
}

/**
 * Colorful rounded-square icon-tile treatment (FIDELITY-2 plan §C): each
 * activity type gets a fixed decorative fill color (design-system §1.1a
 * accent/category tokens) behind its existing `ACTIVITY_TYPE_CONFIG` icon,
 * drawn in white. Both themes share the same fill (mirrors `CategoryGrid`'s
 * treatment) -- no `useColorScheme` branch is needed here any more.
 */
const ACTIVITY_TILE_COLOR: Record<ActivityType, string> = {
  FOOD: "bg-accent-bright",
  WATER: "bg-category-sky",
  POTTY: "bg-accent-warm",
  SLEEP: "bg-category-amber",
  WALK: "bg-category-lilac",
  PLAY: "bg-accent-dark",
  GROOMING: "bg-surface-raised-dark",
};

/**
 * Tap 1 of the tap-first activity logger (design-system §5.1): a grid of
 * the 7 activity-type tiles. Tapping one opens the quantity sheet
 * (`ActivityQuantitySheet`) pre-filled with that type's smart default --
 * this component only reports the selection, it holds no state of its own.
 * Each tile is a `Pressable` at generous `py-5` padding (>=44pt effective
 * target, design-system §4.1).
 */
export function ActivityChipGrid({ onSelect }: ActivityChipGridProps) {
  const bucket = useLayoutBucket();
  const tileBasisClass = bucket === "wide" ? "min-w-[18%] flex-1 basis-[18%]" : "min-w-[28%] flex-1 basis-[28%]";

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
            className={`${tileBasisClass} items-center gap-2 rounded-2xl bg-white dark:bg-surface-card-dark shadow-md px-3 py-5`}
          >
            <View
              testID={`activity-chip-${activityType}-tile`}
              className={`h-11 w-11 items-center justify-center rounded-2xl ${ACTIVITY_TILE_COLOR[activityType]}`}
            >
              <Ionicons name={config.icon} size={22} color="#ffffff" />
            </View>
            <Text className="text-center text-sm font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
