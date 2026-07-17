import { Pressable, Text } from "react-native";

export interface GhostButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

/**
 * Design-system §2.9 ghost button: no border/fill, for tertiary row actions
 * ("Skip", "Not now", "Resend code"). `hitSlop` guarantees a >=44pt
 * effective target even though the label-only content is visually smaller;
 * pressed feedback is `opacity-70` via the same sanctioned inline-style-fn
 * exception `PrimaryButton` uses (CLAUDE §6).
 */
export function GhostButton({ label, onPress, disabled = false, testID }: GhostButtonProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      hitSlop={HIT_SLOP}
      style={({ pressed }) => (pressed && !disabled ? { opacity: 0.7 } : null)}
      className="px-4 py-3"
    >
      <Text maxFontSizeMultiplier={1.5} className="text-base font-semibold text-brand-700">
        {label}
      </Text>
    </Pressable>
  );
}
