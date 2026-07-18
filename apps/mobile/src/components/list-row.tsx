import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

type IconName = ComponentProps<typeof Ionicons>["name"];

export interface ListRowProps {
  testID?: string;
  title: string;
  subtitle?: string;
  leadingIcon?: IconName;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  showChevron?: boolean;
}

const ROOT_CLASS = "flex-row items-center gap-3 py-3 min-h-[56px]";

/**
 * The one nav/list row (design-system.md §2.6): optional leading icon tile,
 * a title/subtitle middle column, and a trailing slot that defaults to a
 * chevron when the row is pressable. Renders a `Pressable` (role="button" +
 * `accessibilityState.disabled`, pressed-opacity feedback) when `onPress` is
 * supplied, else a plain `View` for a static/info row.
 */
export function ListRow({
  testID,
  title,
  subtitle,
  leadingIcon,
  trailing,
  onPress,
  accessibilityLabel,
  disabled = false,
  showChevron = true,
}: ListRowProps) {
  const leading = leadingIcon ? (
    <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-100">
      <Ionicons name={leadingIcon} size={20} color="#1f6350" />
    </View>
  ) : null;

  const middle = (
    <View className="flex-1">
      <Text className="text-base font-semibold text-brand-900">{title}</Text>
      {subtitle ? <Text className="text-sm text-brand-700">{subtitle}</Text> : null}
    </View>
  );

  const resolvedTrailing =
    trailing ?? (showChevron ? <Ionicons name="chevron-forward-outline" size={20} color="#1f6350" /> : null);

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => (pressed && !disabled ? { opacity: 0.85 } : null)}
        className={ROOT_CLASS}
      >
        {leading}
        {middle}
        {resolvedTrailing}
      </Pressable>
    );
  }

  return (
    <View testID={testID} accessibilityLabel={accessibilityLabel} className={ROOT_CLASS}>
      {leading}
      {middle}
      {resolvedTrailing}
    </View>
  );
}
