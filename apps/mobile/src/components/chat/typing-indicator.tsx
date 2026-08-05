import { useEffect } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { useReducedMotion } from "../../hooks/use-reduced-motion";
import { strings } from "../../strings";

const PULSE_DURATION_MS = 700;
const REDUCED_OPACITY = 0.6;

/**
 * The waiting state between `send()` and the first `chunk` (design-system
 * §3.2 reduced-motion contract): three dots pulsing on ONE shared
 * reanimated opacity loop when motion is allowed; a static row otherwise.
 * Mirrors `Skeleton`'s reduced-motion gating exactly.
 */
export function TypingIndicator() {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    if (reduced) {
      return;
    }
    opacity.value = withRepeat(
      withTiming(1, { duration: PULSE_DURATION_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity, reduced]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View
      testID="chat-typing-indicator"
      accessibilityLabel={strings.chat.typingA11y}
      className="max-w-[80%] flex-row items-center gap-1 self-start rounded-2xl bg-brand-50 dark:bg-surface-raised-dark px-4 py-3"
    >
      {[0, 1, 2].map((index) =>
        reduced ? (
          <View
            key={index}
            style={{ opacity: REDUCED_OPACITY }}
            className="h-2 w-2 rounded-full bg-brand-300 dark:bg-ink-muted-dark"
          />
        ) : (
          <Animated.View
            key={index}
            style={pulseStyle}
            className="h-2 w-2 rounded-full bg-brand-300 dark:bg-ink-muted-dark"
          />
        ),
      )}
    </View>
  );
}
