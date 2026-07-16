import { BUNDLED_HOTLINE_PACK_VERSION } from "@pawcareright/data";

import { DEFAULT_APP_CONFIG, useAppConfig } from "./app-config-queries";

/**
 * Hotline-pack staleness seam (T079 plan decision 4 / Risk R9). Pure,
 * NaN-safe comparison: `true` only when the server-sent version is a valid
 * number STRICTLY greater than the bundled version. This is a documented
 * seam for a future OTA hotline-refresh task -- it never downloads, mutates,
 * or renders anything; the bundled numbers in `packages/data` stay the
 * single source of truth for emergency/poison hotlines.
 */
export function isHotlinePackStale(serverVersion: number, bundledVersion: number): boolean {
  if (!Number.isFinite(serverVersion) || !Number.isFinite(bundledVersion)) {
    return false;
  }

  return serverVersion > bundledVersion;
}

/** Derives staleness from the shared `useAppConfig` query + the bundled version tag. Not yet consumed by any UI (plan Risk R9). */
export function useHotlinePackStale(): boolean {
  const { data } = useAppConfig();
  const hotlinePackVersion = data?.hotlinePackVersion ?? DEFAULT_APP_CONFIG.hotlinePackVersion;

  return isHotlinePackStale(hotlinePackVersion, BUNDLED_HOTLINE_PACK_VERSION);
}
