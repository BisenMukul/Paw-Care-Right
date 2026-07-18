import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

export interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  className?: string;
  testID?: string;
  accessibilityLabel?: string;
}

const BASE_CLASS = "rounded-2xl bg-white dark:bg-surface-card-dark p-4 shadow-md gap-2";

/**
 * The one card surface (design-system.md §2.2): static by default, or a
 * `Pressable` (with press feedback + `accessibilityRole="button"`) when
 * `onPress` is supplied. One card = one job; no card-inside-card.
 */
export function Card({ children, onPress, className, testID, accessibilityLabel }: CardProps) {
  const resolvedClassName = className ? `${BASE_CLASS} ${className}` : BASE_CLASS;

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
        className={resolvedClassName}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View testID={testID} accessibilityLabel={accessibilityLabel} className={resolvedClassName}>
      {children}
    </View>
  );
}
