import { useMemo } from "react";

import type { OtaInfo, UpdatesLoader } from "../observability/ota-info";
import { readOtaInfo } from "../observability/ota-info";

/**
 * T113: boot-time OTA identity (`updateId`/`channel`/`runtimeVersion`/
 * `isEmbeddedLaunch`) exposed to the mobile app. These values are fixed for
 * the process lifetime (set at launch by `expo-updates`), so this hook
 * reads them once via `useMemo` -- no state, no effect, no polling.
 *
 * This hook renders nothing and adds no user-facing string (CLAUDE.md §7 is
 * untouched by this card). Consumers: T114 (update-flow UI) and T117
 * (Sentry release tags / PostHog `ota_*` properties) -- neither is
 * implemented here.
 */
export function useOtaInfo(loader?: UpdatesLoader): OtaInfo {
  return useMemo(() => readOtaInfo(loader), [loader]);
}
