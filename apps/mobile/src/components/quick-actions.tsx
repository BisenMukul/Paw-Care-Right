import { Pressable, Text, View } from "react-native";

import { strings } from "../strings";

export interface QuickActionsProps {
  onLogWeight: () => void;
  onReminders: () => void;
}

/** Two-item stub row (T025) — both actions route to the shared coming-soon placeholder. */
export function QuickActions({ onLogWeight, onReminders }: QuickActionsProps) {
  return (
    <View className="flex-row gap-3">
      <Pressable
        testID="quick-action-log-weight"
        onPress={onLogWeight}
        accessibilityRole="button"
        className="flex-1 items-center rounded-lg bg-brand-100 px-4 py-3"
      >
        <Text className="text-base font-semibold text-brand-900">{strings.petHome.logWeight}</Text>
      </Pressable>
      <Pressable
        testID="quick-action-reminders"
        onPress={onReminders}
        accessibilityRole="button"
        className="flex-1 items-center rounded-lg bg-brand-100 px-4 py-3"
      >
        <Text className="text-base font-semibold text-brand-900">{strings.petHome.reminders}</Text>
      </Pressable>
    </View>
  );
}
