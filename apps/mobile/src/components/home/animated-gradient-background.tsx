import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

// Soft brand tones (tailwind-preset.mjs `brand` scale + a warm cream) --
// kept light so the dark `text-brand-900` copy drawn on top stays readable.
const BASE_COLORS = ["#f2f8f6", "#ffffff", "#dcece6"] as const;
const OVERLAY_COLORS = ["#fdf8ef", "#f2f8f6", "#eef7f1"] as const;

// One full crossfade cycle is 2x this (up, then back down) -- ~10s, well
// within the founder's "slow, subtle, ~8-12s loop" ask.
const HALF_CYCLE_MS = 5000;

/**
 * Full-screen animated gradient background for the home tab (founder UI
 * overhaul): a static base gradient plus a second gradient layer whose
 * opacity slowly oscillates between 0 and 1 (`withRepeat` + `withTiming`,
 * `reverse=true`) for a subtle crossfade loop. Exactly ONE reanimated
 * shared-value loop drives this -- no per-frame JS, battery-friendly.
 */
export function AnimatedGradientBackground() {
  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    overlayOpacity.value = withRepeat(
      withTiming(1, { duration: HALF_CYCLE_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [overlayOpacity]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));

  return (
    <View testID="home-gradient-background" pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={BASE_COLORS}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[StyleSheet.absoluteFill, overlayStyle]}>
        <LinearGradient
          colors={OVERLAY_COLORS}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}
