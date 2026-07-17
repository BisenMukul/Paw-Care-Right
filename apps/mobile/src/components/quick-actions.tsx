import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useReducedMotion } from "../hooks/use-reduced-motion";
import { strings } from "../strings";

type IconName = ComponentProps<typeof Ionicons>["name"];

export interface QuickActionsProps {
  onLogWeight: () => void;
  onReminders: () => void;
  onLogActivity: () => void;
  onLogVetVisit: () => void;
}

interface Tile {
  testID: string;
  icon: IconName;
  label: string;
  onPress: () => void;
}

/**
 * Four quick actions wired to their entry points (T066 plan, restyled by
 * the founder UI/UX pass; the "note" tile became "Log activity" -> the
 * tap-first activity logger under the founder-directed activity-log pass --
 * `strings.note.title`'s written-note form stays reachable FROM the
 * activity screen via its "written note" link). Each tile carries an
 * Ionicon, pressed-state feedback, and a short staggered `FadeInDown`
 * entrance (mirrors the home tab's `QuickActionsGrid` — a one-shot mount
 * animation, not a repeating loop). Wraps to a 2x2 grid via
 * `flex-row flex-wrap` so each tile keeps a comfortable tap target
 * regardless of row count.
 */
export function QuickActions({ onLogWeight, onReminders, onLogActivity, onLogVetVisit }: QuickActionsProps) {
  const reduced = useReducedMotion();
  const tiles: Tile[] = [
    {
      testID: "quick-action-log-weight",
      icon: "scale-outline",
      label: strings.petHome.logWeight,
      onPress: onLogWeight,
    },
    {
      testID: "quick-action-log-activity",
      icon: "paw-outline",
      label: strings.petHome.logActivity,
      onPress: onLogActivity,
    },
    {
      testID: "quick-action-log-vet-visit",
      icon: "bandage-outline",
      label: strings.petHome.logVetVisit,
      onPress: onLogVetVisit,
    },
    {
      testID: "quick-action-reminders",
      icon: "notifications-outline",
      label: strings.petHome.reminders,
      onPress: onReminders,
    },
  ];

  return (
    <View className="flex-row flex-wrap gap-3">
      {tiles.map((tile, index) => (
        <Animated.View
          key={tile.testID}
          className="min-w-[45%] flex-1 basis-[45%]"
          {...(reduced ? {} : { entering: FadeInDown.delay(index * 80).duration(320) })}
        >
          <Pressable
            testID={tile.testID}
            onPress={tile.onPress}
            accessibilityRole="button"
            style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
            className="items-center gap-2 rounded-2xl bg-white px-4 py-5 shadow-sm"
          >
            <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-100">
              <Ionicons name={tile.icon} size={22} color="#1f6350" />
            </View>
            <Text className="text-center text-sm font-semibold text-brand-900">{tile.label}</Text>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}
