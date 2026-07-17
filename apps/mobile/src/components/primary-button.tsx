import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";

type IconName = ComponentProps<typeof Ionicons>["name"];

export interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  /** Optional leading Ionicon (founder UI pass) — omit for the original label-only look. */
  icon?: IconName;
}

/**
 * Small reusable CTA shared by most of the app's forms/screens. Founder UI
 * pass adds pressed-state feedback (a dynamic `style` function — the
 * CLAUDE §6-sanctioned exception to "no inline style objects") and an
 * optional leading icon; every other prop keeps its exact original
 * behavior, so all existing call sites work untouched.
 */
export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  testID,
  icon,
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => (pressed && !isDisabled ? { opacity: 0.85 } : null)}
      className={
        isDisabled
          ? "flex-row items-center justify-center gap-2 rounded-lg bg-brand-300 px-6 py-3"
          : "flex-row items-center justify-center gap-2 rounded-lg bg-brand-700 px-6 py-3"
      }
    >
      {loading ? (
        <ActivityIndicator color="#ffffff" testID={testID ? `${testID}-spinner` : undefined} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color="#ffffff" /> : null}
          <Text className="text-base font-semibold text-white">{label}</Text>
        </>
      )}
    </Pressable>
  );
}
