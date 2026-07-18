import { Pressable, Text } from "react-native";

export interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
}

const SELECTED_CLASS = "min-h-[44px] justify-center rounded-full bg-brand-700 dark:bg-accent-dark px-4 py-2.5";
const UNSELECTED_CLASS =
  "min-h-[44px] justify-center rounded-full border border-brand-100 dark:border-hairline-dark bg-white dark:bg-surface-card-dark px-4 py-2.5";
const TEXT_SELECTED = "text-sm font-semibold text-white font-body-semibold";
const TEXT_UNSELECTED = "text-sm text-brand-900 dark:text-ink-dark font-body-semibold";

/**
 * The one selectable-pill surface (design-system.md §2.5): a single
 * `Pressable` that carries the forwarded `testID`, `accessibilityRole`,
 * `accessibilityState.selected`, and a className that INCLUDES
 * `min-h-[44px] justify-center` on top of the §2.5 fills (SWEEP-4 plan Risk
 * R2 -- `touch-targets.test.tsx` reads `.props.className` on this exact
 * node). The label caps font scaling at 1.5x -- a chip's chrome is fixed,
 * not a body-copy field.
 */
export function Chip({ label, selected, onPress, testID, accessibilityLabel }: ChipProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
      className={selected ? SELECTED_CLASS : UNSELECTED_CLASS}
    >
      <Text maxFontSizeMultiplier={1.5} className={selected ? TEXT_SELECTED : TEXT_UNSELECTED}>
        {label}
      </Text>
    </Pressable>
  );
}
