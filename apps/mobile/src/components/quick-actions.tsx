import { Pressable, Text, View } from "react-native";

import { strings } from "../strings";

export interface QuickActionsProps {
  onLogWeight: () => void;
  onReminders: () => void;
  onLogNote: () => void;
  onLogVetVisit: () => void;
}

/**
 * Four quick actions wired to their entry points (T066 plan): weight, note,
 * vet visit, and reminders. Wraps to a 2x2 grid via `flex-row flex-wrap` so
 * each tile keeps a comfortable tap target regardless of row count.
 */
export function QuickActions({ onLogWeight, onReminders, onLogNote, onLogVetVisit }: QuickActionsProps) {
  return (
    <View className="flex-row flex-wrap gap-3">
      <Pressable
        testID="quick-action-log-weight"
        onPress={onLogWeight}
        accessibilityRole="button"
        className="min-w-[45%] flex-1 basis-[45%] items-center rounded-lg bg-brand-100 px-4 py-3"
      >
        <Text className="text-base font-semibold text-brand-900">{strings.petHome.logWeight}</Text>
      </Pressable>
      <Pressable
        testID="quick-action-log-note"
        onPress={onLogNote}
        accessibilityRole="button"
        className="min-w-[45%] flex-1 basis-[45%] items-center rounded-lg bg-brand-100 px-4 py-3"
      >
        <Text className="text-base font-semibold text-brand-900">{strings.petHome.logNote}</Text>
      </Pressable>
      <Pressable
        testID="quick-action-log-vet-visit"
        onPress={onLogVetVisit}
        accessibilityRole="button"
        className="min-w-[45%] flex-1 basis-[45%] items-center rounded-lg bg-brand-100 px-4 py-3"
      >
        <Text className="text-base font-semibold text-brand-900">{strings.petHome.logVetVisit}</Text>
      </Pressable>
      <Pressable
        testID="quick-action-reminders"
        onPress={onReminders}
        accessibilityRole="button"
        className="min-w-[45%] flex-1 basis-[45%] items-center rounded-lg bg-brand-100 px-4 py-3"
      >
        <Text className="text-base font-semibold text-brand-900">{strings.petHome.reminders}</Text>
      </Pressable>
    </View>
  );
}
