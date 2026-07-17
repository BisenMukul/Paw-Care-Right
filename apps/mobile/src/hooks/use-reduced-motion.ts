import { useReducedMotion as useReanimatedReducedMotion } from "react-native-reanimated";

/**
 * The single import point for ALL motion gating in this app
 * (design-system.md §3.2): every `entering` prop, every `withRepeat` loop
 * checks this hook before animating. Thin wrapper over reanimated's own
 * `useReducedMotion`, which reads the OS "Reduce Motion" setting
 * synchronously at app start (backed by
 * `AccessibilityInfo.isReduceMotionEnabled`).
 */
export function useReducedMotion(): boolean {
  return useReanimatedReducedMotion();
}
