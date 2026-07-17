import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useReducedMotion } from "../hooks/use-reduced-motion";

export interface SkeletonProps {
  /** Number of placeholder bones to render. Default 3. */
  lines?: number;
  testID?: string;
  className?: string;
}

const DEFAULT_LINES = 3;
const PULSE_DURATION_MS = 1000;
const REDUCED_OPACITY = 0.6;

/**
 * Content-shaped loading placeholder (design-system.md §2.11): `lines`
 * `rounded-lg bg-brand-100` bones (the last one narrower), driven by ONE
 * shared reanimated opacity pulse (0.5<->1, ~1000ms, `withRepeat`).
 * `reduced === true` (design-system.md §3.2) ⇒ the pulse never starts --
 * bones render at a static opacity instead.
 */
export function Skeleton({ lines = DEFAULT_LINES, testID, className }: SkeletonProps) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0.5);

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
    <View {...(testID ? { testID } : {})} {...(className ? { className } : {})}>
      {Array.from({ length: lines }, (_, index) => {
        const isLast = index === lines - 1;
        const boneClassName = [
          "h-4 rounded-lg bg-brand-100",
          isLast ? "w-2/3" : "w-full",
          index > 0 ? "mt-2" : "",
        ]
          .filter(Boolean)
          .join(" ");

        if (reduced) {
          return (
            <View
              key={index}
              testID={testID ? `${testID}-bone-${index}` : undefined}
              style={{ opacity: REDUCED_OPACITY }}
              className={boneClassName}
            />
          );
        }

        return (
          <Animated.View
            key={index}
            testID={testID ? `${testID}-bone-${index}` : undefined}
            style={pulseStyle}
            className={boneClassName}
          />
        );
      })}
    </View>
  );
}
