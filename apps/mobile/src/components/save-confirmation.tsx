import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

export interface SaveConfirmationProps {
  testID?: string;
  message: string;
  nudge?: string;
}

/**
 * Design-system §7.5 "Peak-End" save confirmation: the emotional peak of a
 * care-log flow gets a soft, non-dismissible (parent owns lifetime) banner
 * with ONE line of record-only encouragement plus an optional gentle
 * next-step nudge. No animation (stays outside the §3 motion contract), no
 * dismiss control.
 */
export function SaveConfirmation({ testID, message, nudge }: SaveConfirmationProps) {
  return (
    <View
      {...(testID !== undefined ? { testID } : {})}
      accessibilityRole="alert"
      className="flex-row items-start gap-2 rounded-lg bg-brand-50 dark:bg-surface-raised-dark px-4 py-3"
    >
      <Ionicons name="checkmark-circle" size={20} color="#2f8f74" />
      <View className="flex-1 gap-1">
        <Text className="text-sm font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">{message}</Text>
        {nudge !== undefined ? (
          <Text className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">{nudge}</Text>
        ) : null}
      </View>
    </View>
  );
}
