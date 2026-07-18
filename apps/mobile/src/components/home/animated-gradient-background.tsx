import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";

import { StyleSheet, useColorScheme, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useReducedMotion } from "../../hooks/use-reduced-motion";
import { isNativeGradientAvailable } from "./native-gradient";

// Soft brand tones (tailwind-preset.mjs `brand` scale + a warm cream) --
// kept light so the dark `text-brand-900` copy drawn on top stays readable.
const BASE_COLORS = ["#f2f8f6", "#ffffff", "#dcece6"] as const;
const OVERLAY_COLORS = ["#fdf8ef", "#f2f8f6", "#eef7f1"] as const;

// Dark-theme stops (PAWSAATHI-1 plan Decision 5 / Risk R5): the exact same
// `surface.page-dark`/`surface.raised-dark`/`surface.card-dark` tokens the
// canon components use, so `text-ink-dark` copy drawn directly over this
// background (e.g. `HomeHeader`'s greeting) stays inside the already
// AA-verified ink-dark-on-{page,card,raised}-dark pairs
// (`dual-theme-contrast.test.ts`). `expo-linear-gradient` is linear-only,
// so this is a top-down approximation of the mockup's dark radial glow.
const DARK_BASE_COLORS = ["#0c140f", "#0b1712", "#143026"] as const;
const DARK_OVERLAY_COLORS = ["#16241F", "#0c140f", "#143026"] as const;

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
  // Probed once per mount: a dev client built without expo-linear-gradient
  // has no native ViewManager for it -- mounting would crash Fabric. Fall
  // back to a calm solid brand tone; the animated gradient appears
  // automatically once the app runs in a build that includes the module.
  const nativeAvailable = isNativeGradientAvailable();
  const reduced = useReducedMotion();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const baseColors = isDark ? DARK_BASE_COLORS : BASE_COLORS;
  const overlayColors = isDark ? DARK_OVERLAY_COLORS : OVERLAY_COLORS;
  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    // Reduced motion: the crossfade loop never starts -- the static base
    // gradient is the whole picture (design-system.md §3.2).
    if (reduced) {
      return;
    }
    overlayOpacity.value = withRepeat(
      withTiming(1, { duration: HALF_CYCLE_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [overlayOpacity, reduced]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));

  if (!nativeAvailable) {
    return (
      <View
        testID="home-gradient-fallback"
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: baseColors[0] }]}
      />
    );
  }

  return (
    <View testID="home-gradient-background" pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={baseColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {reduced ? null : (
        <Animated.View
          testID="home-gradient-overlay"
          style={[StyleSheet.absoluteFill, overlayStyle]}
        >
          <LinearGradient
            colors={overlayColors}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}
