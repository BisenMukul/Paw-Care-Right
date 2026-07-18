import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { ActivityIndicator, Pressable, Text, useColorScheme } from "react-native";

type IconName = ComponentProps<typeof Ionicons>["name"];

export interface SecondaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  icon?: IconName;
}

/**
 * Design-system §2.9 secondary button: `brand-700` outline on white, for the
 * non-primary action in a screen's button hierarchy (one `PrimaryButton` per
 * region). Same call shape as `PrimaryButton` so screens can swap variants
 * without touching prop wiring; pressed feedback tints `brand-50` via the
 * same sanctioned inline-style-fn exception `PrimaryButton` uses (CLAUDE §6).
 */
export function SecondaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  testID,
  icon,
}: SecondaryButtonProps) {
  const isDisabled = disabled || loading;
  const scheme = useColorScheme();
  const pressedTint = scheme === "dark" ? "#143026" : "#f2f8f6";

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => (pressed && !isDisabled ? { backgroundColor: pressedTint } : null)}
      className="flex-row items-center justify-center gap-2 rounded-lg border border-brand-700 dark:border-accent-bright bg-white dark:bg-surface-card-dark px-6 py-3"
    >
      {loading ? (
        <ActivityIndicator color="#1f6350" testID={testID ? `${testID}-spinner` : undefined} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color="#1f6350" /> : null}
          <Text
            maxFontSizeMultiplier={1.5}
            className="text-base font-semibold text-brand-700 dark:text-accent-bright font-body-semibold"
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
