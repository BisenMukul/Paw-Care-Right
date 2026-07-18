import * as Haptics from "expo-haptics";

/**
 * The one sanctioned haptics entry point (design-system §3.3) -- every
 * haptic call in the app goes through here so a future settings toggle is a
 * single change. Every call swallows BOTH sync throws and promise
 * rejections: on a dev client built before expo-haptics was added, the SDK
 * rejects with UnavailabilityError ("not available on android"), which a
 * bare try/catch around a voided promise cannot catch (founder crash
 * report) -- a haptics failure must never block a save.
 *
 * Used at exactly the two design-system §3.3 moments this feature touches:
 * chip-select and save-success in the tap-first activity logger.
 */
export const haptics = {
  /** Light impact -- chip select. */
  selection(): void {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    } catch {
      // No-op: haptics are a nice-to-have, never load-bearing.
    }
  },
  /** Success notification -- save success. */
  success(): void {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch {
      // No-op: haptics are a nice-to-have, never load-bearing.
    }
  },
};
