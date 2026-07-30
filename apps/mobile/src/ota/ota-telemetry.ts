import { createSafeStorage } from "../storage/safe-storage";

/**
 * T117 D2: a signed-out cold start cannot emit `ota_applied` immediately
 * (`captureEvent` never invents an anonymous distinctId,
 * `apps/mobile/src/analytics/analytics.ts:26-32`). Instead of losing the
 * event entirely, "an update was downloaded" is persisted here and only
 * cleared once the corresponding `ota_applied` event actually fires -- so a
 * signed-out apply reports on the next signed-in launch. Mirrors
 * `update-throttle.ts`'s `createSafeStorage` idiom verbatim: the storage
 * layer falls back to memory when the native MMKV binding is unavailable
 * (Expo Go / jest), so this never crashes at module load, and every read is
 * re-validated so a poisoned stored value is treated as absent rather than
 * trusted.
 */
const mmkv = createSafeStorage({
  createMmkv: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: lazy runtime require so a missing native MMKV binding (Expo Go) falls back instead of crashing at module load
    const { createMMKV } = require("react-native-mmkv");
    return createMMKV();
  },
});

const PENDING_APPLIED_KEY = "bombaypetcompany.ota-pending-applied";

/** 7 days, in milliseconds (D2) — a stale `latencyMs` is worse than no event. */
export const PENDING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface PendingApplied {
  fromUpdateId: string | null;
  downloadedAtMs: number;
}

/** Type guard for a poisoned/malformed stored value -- re-validated on every read. */
function isValidPendingApplied(value: unknown): value is PendingApplied {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  const validFromUpdateId = candidate.fromUpdateId === null || typeof candidate.fromUpdateId === "string";
  const validDownloadedAtMs =
    typeof candidate.downloadedAtMs === "number" &&
    Number.isFinite(candidate.downloadedAtMs) &&
    Number.isInteger(candidate.downloadedAtMs) &&
    candidate.downloadedAtMs >= 0;
  return validFromUpdateId && validDownloadedAtMs;
}

/** Persists the "an update was downloaded" record (called right after a successful fetch). */
export function writePendingApplied(record: PendingApplied): void {
  mmkv.set(PENDING_APPLIED_KEY, JSON.stringify(record));
}

/**
 * Re-validated on read: a poisoned/malformed/non-JSON stored value is
 * treated as "no pending record" (`null`) rather than trusted, the same
 * fail-open precedent as `update-throttle.ts`'s `readLastCheckAt`.
 */
export function readPendingApplied(): PendingApplied | null {
  const raw = mmkv.getString(PENDING_APPLIED_KEY);
  if (raw === undefined) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  return isValidPendingApplied(parsed) ? parsed : null;
}

/** Clears the pending-applied record — called only once the `ota_applied` event has actually fired. */
export function clearPendingApplied(): void {
  mmkv.remove(PENDING_APPLIED_KEY);
}

export interface AppliedEvent {
  updateId: string | null;
  fromUpdateId: string | null;
  latencyMs: number;
}

/**
 * Pure decision function (D2): `null` when there is no pending record, when
 * `current === pending.fromUpdateId` (nothing actually applied — the app is
 * still running the same update it downloaded from), or when the record is
 * older than `PENDING_MAX_AGE_MS`. `latencyMs` is clamped to `>= 0` so a
 * backwards clock can never produce a negative latency.
 */
export function computeAppliedEvent(args: {
  current: string | null;
  pending: PendingApplied | null;
  nowMs: number;
}): AppliedEvent | null {
  const { current, pending, nowMs } = args;

  if (pending === null) {
    return null;
  }

  if (current === pending.fromUpdateId) {
    return null;
  }

  if (nowMs - pending.downloadedAtMs > PENDING_MAX_AGE_MS) {
    return null;
  }

  const latencyMs = Math.max(0, nowMs - pending.downloadedAtMs);

  return {
    updateId: current,
    fromUpdateId: pending.fromUpdateId,
    latencyMs,
  };
}
