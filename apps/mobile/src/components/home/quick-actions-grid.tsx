import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useReducedMotion } from "../../hooks/use-reduced-motion";
import { strings } from "../../strings";

type IconName = ComponentProps<typeof Ionicons>["name"];

export interface QuickActionsGridProps {
  disabled: boolean;
  onCheckSymptoms: () => void;
  onLogWeight: () => void;
  onLogActivity: () => void;
  onVetVisit: () => void;
}

interface Tile {
  testID: string;
  icon: IconName;
  label: string;
  onPress: () => void;
}

/**
 * Home tab 2x2 quick-actions grid (founder UI overhaul): symptom check,
 * log weight, log activity, and vet visit -- each entrance-animated with a
 * short staggered `FadeInDown` (a one-shot mount animation, not a repeating
 * loop, so it stays battery-friendly). Every tile is disabled (reduced
 * opacity, no navigation) when there is no active pet. The former "add
 * note" tile became "Log activity" -> the tap-first activity logger
 * (founder-directed activity-log pass); the written-note form stays
 * reachable FROM that screen via its "written note" link.
 */
export function QuickActionsGrid({
  disabled,
  onCheckSymptoms,
  onLogWeight,
  onLogActivity,
  onVetVisit,
}: QuickActionsGridProps) {
  const reduced = useReducedMotion();
  const tiles: Tile[] = [
    {
      testID: "home-quick-action-check",
      icon: "medkit-outline",
      label: strings.home.quickActions.symptomCheck,
      onPress: onCheckSymptoms,
    },
    {
      testID: "home-quick-action-weight",
      icon: "scale-outline",
      label: strings.petHome.logWeight,
      onPress: onLogWeight,
    },
    {
      testID: "home-quick-action-activity",
      icon: "paw-outline",
      label: strings.petHome.logActivity,
      onPress: onLogActivity,
    },
    {
      testID: "home-quick-action-vet-visit",
      icon: "business-outline",
      label: strings.petHome.logVetVisit,
      onPress: onVetVisit,
    },
  ];

  return (
    <View testID="home-quick-actions" className="flex-row flex-wrap gap-3">
      {tiles.map((tile, index) => (
        <Animated.View
          key={tile.testID}
          className="min-w-[45%] flex-1 basis-[45%]"
          {...(reduced ? {} : { entering: FadeInDown.delay(index * 80).duration(320) })}
        >
          <Pressable
            testID={tile.testID}
            onPress={tile.onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            className={
              disabled
                ? "items-center gap-2 rounded-2xl bg-brand-50 px-4 py-5 opacity-40"
                : "items-center gap-2 rounded-2xl bg-brand-50 px-4 py-5"
            }
          >
            <Ionicons name={tile.icon} size={26} color="#1f6350" />
            <Text className="text-center text-sm font-semibold text-brand-900">{tile.label}</Text>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}
