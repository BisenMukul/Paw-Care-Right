/**
 * T113: boot-time OTA identity (updateId/channel/runtimeVersion/embedded
 * status) read from `expo-updates`, machine-values only -- no user-facing
 * string, no throw. See CLAUDE.md §7 (safety copy is untouched by this
 * file) and OTA_UPDATES.md §1/§7.
 *
 * Consumers: `useOtaInfo` (`src/hooks/use-ota-info.ts`); T114 (update-flow
 * UI) and T117 (Sentry release tags / PostHog `ota_*` properties) read this
 * shape but are NOT implemented here.
 */

/** Machine-readable OTA identity for the running process. */
export interface OtaInfo {
  isEnabled: boolean;
  updateId: string | null;
  channel: string | null;
  runtimeVersion: string | null;
  isEmbeddedLaunch: boolean;
}

/**
 * Narrow shape of the `expo-updates` module this file reads. Every field is
 * optional so a partial mock fixture (a test supplying only the fields it
 * cares about) stays a valid `UpdatesNative` -- mirrors `PurchasesNative`'s
 * optional-method note in `src/billing/purchases.ts`.
 */
export interface UpdatesNative {
  isEnabled?: boolean;
  updateId?: string | null;
  channel?: string | null;
  runtimeVersion?: string | null;
  isEmbeddedLaunch?: boolean;
}

export type UpdatesLoader = () => UpdatesNative | null;

/** The all-absent shape returned whenever the native module cannot be read. */
const ABSENT_OTA_INFO: OtaInfo = {
  isEnabled: false,
  updateId: null,
  channel: null,
  runtimeVersion: null,
  isEmbeddedLaunch: true,
};

/**
 * Lazy runtime require of `expo-updates`, mirroring `purchases.ts`'s
 * `defaultLoader`: the native module cannot load in Expo Go / the jest
 * container, so it is never imported at module top level. A failed
 * `require` resolves to `null`; `readOtaInfo` treats `null` exactly like a
 * throw -- the all-absent shape, never a crash.
 */
export const defaultLoader: UpdatesLoader = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: lazy runtime require so a missing native expo-updates binding (Expo Go / jest) falls back instead of crashing at module load
    const mod = require("expo-updates");
    return (mod ?? null) as UpdatesNative | null;
  } catch {
    return null;
  }
};

/** Normalizes a nullable string field: non-string and empty-string both become `null`. */
function normalizeNullableString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * Reads boot-time OTA identity via `loader`. Never throws: a `null` loader
 * result, or a loader that itself throws, both resolve to the all-absent
 * shape (`isEnabled: false`, every id `null`, `isEmbeddedLaunch: true`) --
 * the safe default for Expo Go / jest / any environment where the native
 * module cannot be read. Empty-string `channel`/`updateId` normalise to
 * `null` because EAS reports `""` vs `null` inconsistently across
 * dev-client/embedded launches, and a falsy channel must never masquerade
 * as a real one.
 */
export function readOtaInfo(loader: UpdatesLoader = defaultLoader): OtaInfo {
  let native: UpdatesNative | null;
  try {
    native = loader();
  } catch {
    return ABSENT_OTA_INFO;
  }

  if (native === null) {
    return ABSENT_OTA_INFO;
  }

  return {
    isEnabled: native.isEnabled === true,
    updateId: normalizeNullableString(native.updateId),
    channel: normalizeNullableString(native.channel),
    runtimeVersion: normalizeNullableString(native.runtimeVersion),
    isEmbeddedLaunch: native.isEmbeddedLaunch !== false,
  };
}
