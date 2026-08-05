import { FEATURE_KEYS, PAYWALL_VARIANTS } from "@bombaypetcompany/types";

import { createSafeStorage } from "../storage/safe-storage";
import type { AppConfig } from "./app-config-queries";

/** Persisted MMKV last-known-good cache (T079 plan decision 5), mirrors `paywall-shown-store.ts`'s
 *  `createSafeStorage` pattern: the storage layer falls back to memory when the native MMKV binding
 *  is unavailable (Expo Go / jest), so this never crashes at module load. */
const mmkv = createSafeStorage({
  createMmkv: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: lazy runtime require so a missing native MMKV binding (Expo Go) falls back instead of crashing at module load
    const { createMMKV } = require("react-native-mmkv");
    return createMMKV();
  },
});

const CACHE_KEY = "bombaypetcompany.app-config-cache";

/**
 * Re-validated on read (plan Risk R4): a poisoned/corrupt stored value is
 * treated as "no cache" (`null`) rather than trusted, so it can never force
 * an update gate or inject a bogus variant/version. A plain type guard --
 * NOT a `zod` schema -- because `zod` is not a direct `apps/mobile`
 * dependency (only consumed indirectly via already-built schemas exported
 * from `@bombaypetcompany/types`); this keeps the "no new dependencies" rule
 * intact while still re-validating every field the same schema would.
 *
 * T106: also requires `features` to be an object with exactly the three
 * documented boolean flags. A LEGACY cached blob written before T106 (no
 * `features` key at all) is treated as "no cache" (`null`) -- the caller
 * then falls back to `DEFAULT_APP_CONFIG`, which is fail-open (D10), so a
 * pre-T106 cache can never silently disable a feature nor silently enable
 * one either; it is simply discarded and re-fetched.
 *
 * T114: also requires `criticalOtaVersion` to be `null` or a string. A
 * pre-T114 cached blob (key absent entirely -- `undefined`) is discarded as
 * "no cache", the same fail-open precedent as the T106 `features` addition.
 *
 * T115: also requires `minAppVersion`/`recommendedAppVersion` to each be an
 * `{ios: string, android: string}` pair. A pre-T115 cached blob (keys absent
 * entirely) is discarded as "no cache" -- same fail-open precedent; the
 * caller then falls back to `DEFAULT_APP_CONFIG`, whose T115 fields are
 * "0.0.0" on both platforms (no gate).
 */
function isValidFeatureFlags(value: unknown): value is AppConfig["features"] {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return FEATURE_KEYS.every((key) => typeof candidate[key] === "boolean");
}

function isValidPlatformAppVersions(value: unknown): value is AppConfig["minAppVersion"] {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.ios === "string" && typeof candidate.android === "string";
}

function isValidAppConfig(value: unknown): value is AppConfig {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const variant = candidate.variant;
  const minSupportedVersion = candidate.minSupportedVersion;
  const hotlinePackVersion = candidate.hotlinePackVersion;

  return (
    typeof variant === "string" &&
    (PAYWALL_VARIANTS as readonly string[]).includes(variant) &&
    typeof minSupportedVersion === "string" &&
    typeof hotlinePackVersion === "number" &&
    Number.isInteger(hotlinePackVersion) &&
    hotlinePackVersion >= 0 &&
    isValidFeatureFlags(candidate.features) &&
    (candidate.criticalOtaVersion === null || typeof candidate.criticalOtaVersion === "string") &&
    isValidPlatformAppVersions(candidate.minAppVersion) &&
    isValidPlatformAppVersions(candidate.recommendedAppVersion)
  );
}

/** Reads the last-known-good config from MMKV, re-validating the stored JSON. Returns `null` when absent, corrupt, or schema-invalid. */
export function readCachedConfig(): AppConfig | null {
  const raw = mmkv.getString(CACHE_KEY);

  if (raw === undefined) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return isValidAppConfig(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Writes the last-known-good config to MMKV (called only after a successful, schema-valid fetch). */
export function writeCachedConfig(config: AppConfig): void {
  mmkv.set(CACHE_KEY, JSON.stringify(config));
}
