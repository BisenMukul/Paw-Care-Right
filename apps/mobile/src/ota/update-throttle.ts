import { createSafeStorage } from "../storage/safe-storage";

/**
 * T114: persisted "last foreground OTA re-check" timestamp. Cold start
 * always runs a check cycle (docs/OTA_UPDATES.md §3 bullet 1) — this store
 * only throttles the *foreground* re-check to once per 6h, and the
 * timestamp survives process death (MMKV), mirroring `app-config-cache.ts`'s
 * `createSafeStorage` pattern: the storage layer falls back to memory when
 * the native MMKV binding is unavailable (Expo Go / jest), so this never
 * crashes at module load.
 */
const mmkv = createSafeStorage({
  createMmkv: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: lazy runtime require so a missing native MMKV binding (Expo Go) falls back instead of crashing at module load
    const { createMMKV } = require("react-native-mmkv");
    return createMMKV();
  },
});

const LAST_CHECK_AT_KEY = "bombaypetcompany.ota-last-check-at";

/** 6 hours, in milliseconds (docs/OTA_UPDATES.md §3). */
export const FOREGROUND_RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Re-validated on read: a poisoned/non-numeric/negative/non-integer stored
 * value is treated as "never checked" (`null`) rather than trusted, the
 * same fail-open precedent as `app-config-cache.ts`'s `isValidAppConfig`.
 */
export function readLastCheckAt(): number | null {
  const raw = mmkv.getString(LAST_CHECK_AT_KEY);

  if (raw === undefined) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

/** Persists the last-check timestamp (epoch ms). */
export function writeLastCheckAt(at: number): void {
  mmkv.set(LAST_CHECK_AT_KEY, String(at));
}

/**
 * Pure throttle predicate: `true` when a foreground re-check should run.
 * `lastCheckAt === null` (never checked) or the 6h window has elapsed both
 * mean "check now". A `lastCheckAt` in the future (backwards clock) also
 * means "check now" — a wedged clock must never permanently block checks.
 */
export function shouldRecheck(now: number, lastCheckAt: number | null): boolean {
  if (lastCheckAt === null) {
    return true;
  }

  if (lastCheckAt > now) {
    return true;
  }

  return now - lastCheckAt >= FOREGROUND_RECHECK_INTERVAL_MS;
}
