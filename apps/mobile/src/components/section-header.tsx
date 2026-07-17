import { Pressable, Text, View } from "react-native";

export interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  actionTestID?: string;
}

const ACTION_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

/**
 * The section title + optional trailing action (design-system.md §2.3),
 * e.g. "Quick actions" or a "See all" link. The action is a `Pressable`
 * with `hitSlop` so its small text still reaches the 44pt touch target
 * (design-system.md §4.1).
 */
export function SectionHeader({ title, actionLabel, onAction, actionTestID }: SectionHeaderProps) {
  return (
    <View className="flex-row items-center justify-between">
      <Text accessibilityRole="header" className="text-lg font-semibold text-brand-900">
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          hitSlop={ACTION_HIT_SLOP}
          accessibilityRole="button"
          testID={actionTestID}
          onPress={onAction}
        >
          <Text className="text-sm font-semibold text-brand-700">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
