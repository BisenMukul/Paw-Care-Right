import * as Haptics from "expo-haptics";

/**
 * The one sanctioned haptics entry point (design-system §3.3) -- every
 * haptic call in the app goes through here so a future settings toggle is a
 * single change. `expo-haptics` is Expo-Go-bundled (no lazy-guard needed,
 * per design-system §5's founder brief), but every call is still wrapped in
 * try/catch to match the app's defensive pattern for native modules (e.g.
 * `photos`/`compress-image`) -- a haptics failure must never block a save.
 *
 * Used at exactly the two design-system §3.3 moments this feature touches:
 * chip-select and save-success in the tap-first activity logger.
 */
export const haptics = {
  /** Light impact -- chip select. */
  selection(): void {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // No-op: haptics are a nice-to-have, never load-bearing.
    }
  },
  /** Success notification -- save success. */
  success(): void {
    try {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // No-op: haptics are a nice-to-have, never load-bearing.
    }
  },
};
