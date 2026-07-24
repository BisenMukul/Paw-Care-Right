import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, useColorScheme, View } from "react-native";

import { strings } from "../strings";

export interface AppHeaderProps {
  /** Omitted -> no title node (back-only bar), e.g. the two §5-adjacent pinned screens. */
  title?: string;
  /** Required; the bar's reason to exist is the back control. */
  onBack: () => void;
}

const BACK_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

/**
 * The canon compact header bar (design-system.md §1.4a/§4, FOUNDER-UX-3
 * plan): a 44pt back chevron plus an optional title, both themes. Renders no
 * `SafeAreaView` of its own -- the composing scaffold/screen owns
 * `edges={["top"]}`, so this bar sits directly below the safe-area inset.
 * `Ionicons`' `color` prop doesn't respond to `dark:` classes (design-system
 * §1.6) -- computed here from `useColorScheme()`, the established
 * light/dark pair.
 */
export function AppHeader({ title, onBack }: AppHeaderProps) {
  const scheme = useColorScheme();
  const iconColor = scheme === "dark" ? "#2EA57C" : "#1f6350";

  return (
    <View testID="app-header" className="flex-row items-center px-2 py-2">
      <Pressable
        testID="app-header-back"
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={strings.nav.back}
        hitSlop={BACK_HIT_SLOP}
        style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
        className="h-11 w-11 items-center justify-center rounded-full"
      >
        <Ionicons name="chevron-back" size={24} color={iconColor} />
      </Pressable>
      {title ? (
        <Text
          testID="app-header-title"
          accessibilityRole="header"
          maxFontSizeMultiplier={1.5}
          className="flex-1 text-lg font-semibold text-brand-900 dark:text-ink-dark font-display-semibold"
        >
          {title}
        </Text>
      ) : null}
    </View>
  );
}
