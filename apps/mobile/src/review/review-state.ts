import { createSafeStorage } from "../storage/safe-storage";
import { nextStreak, type ReviewGateState } from "./review-trigger";

/**
 * T109: persisted smart-review-prompt gate state (`ReviewGateState`), MMKV,
 * mirroring `ota/update-throttle.ts`'s `createSafeStorage` idiom: the
 * storage layer falls back to memory when the native MMKV binding is
 * unavailable (Expo Go / jest), so this never crashes at module load. Every
 * exported function is internally guarded so it can never throw into a
 * caller -- a review counter must never break a care flow.
 */
const mmkv = createSafeStorage({
  createMmkv: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: lazy runtime require so a missing native MMKV binding (Expo Go) falls back instead of crashing at module load
    const { createMMKV } = require("react-native-mmkv");
    return createMMKV();
  },
});

const LAST_PROMPTED_AT_KEY = "bombaypetcompany.review-last-prompted-at";
const LAST_EMERGENCY_AT_KEY = "bombaypetcompany.review-last-emergency-at";
const COMPLETION_STREAK_KEY = "bombaypetcompany.review-completion-streak";

/**
 * Re-validation mirrors `readLastCheckAt` (`ota/update-throttle.ts`): a
 * poisoned/non-numeric/negative/non-integer stored value is treated as
 * "never happened" (`null`) rather than trusted.
 */
function readTimestamp(key: string): number | null {
  const raw = mmkv.getString(key);

  if (raw === undefined) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

/** Same re-validation as `readTimestamp`, but a poisoned value falls back to `0` (never-streaked) rather than `null`. */
function readStreak(): number {
  const raw = mmkv.getString(COMPLETION_STREAK_KEY);

  if (raw === undefined) {
    return 0;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

/** Reads the full persisted gate state, re-validating every field. */
export function readReviewGateState(): ReviewGateState {
  return {
    lastPromptedAt: readTimestamp(LAST_PROMPTED_AT_KEY),
    lastEmergencyAt: readTimestamp(LAST_EMERGENCY_AT_KEY),
    completionStreak: readStreak(),
  };
}

/** Persists the last-prompted timestamp (epoch ms). */
export function writeLastPromptedAt(at: number): void {
  mmkv.set(LAST_PROMPTED_AT_KEY, String(at));
}

/** Persists an emergency sighting (epoch ms, defaults to `Date.now()`). */
export function recordEmergencySeen(at: number = Date.now()): void {
  mmkv.set(LAST_EMERGENCY_AT_KEY, String(at));
}

/**
 * Persists the next streak value for a reminder event (`nextStreak`,
 * `review-trigger.ts`) and returns it so a call site can decide whether to
 * fire a review request without a second read.
 */
export function recordReminderEvent(event: "completed" | "snoozed" | "missed"): number {
  const streak = nextStreak(readStreak(), event);
  mmkv.set(COMPLETION_STREAK_KEY, String(streak));
  return streak;
}
