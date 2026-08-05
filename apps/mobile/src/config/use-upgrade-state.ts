import { Platform } from "react-native";
import { useState } from "react";

import { getAppVersionWithBuild } from "../config";

import { DEFAULT_APP_CONFIG, useAppConfig } from "./app-config-queries";
import { resolveUpgradeState, type UpgradeState } from "./version-gate";

/**
 * T115 forced/recommended binary upgrade gate decision, computed ONCE at
 * first mount via a lazy `useState` initializer -- the SAME cold-launch-only
 * guarantee as `<UpdateGate>`'s pre-existing snapshot (T080 plan decision 1;
 * see `update-gate.tsx`'s header comment for the full rationale). A
 * post-mount config refetch (e.g. driven by the shared `["app-config"]`
 * cache's other observers -- the paywall, this same hook re-rendering
 * elsewhere) can therefore never raise or drop the gate over an
 * already-live tree mid-session; the fresh config is honoured normally on
 * the next cold launch (new mount -> new snapshot).
 *
 * Every input is read with a PER-FIELD fallback to `DEFAULT_APP_CONFIG`
 * (fail-open): a partial mocked/cached config missing the T115 fields
 * entirely (e.g. `emergency-interstitial.test.tsx` / `paywall-config.test.tsx`,
 * which mock `useAppConfig()` with objects that predate this hook) still
 * resolves to `"none"` -- never a crash, never an accidental gate.
 */
export function useUpgradeState(): UpgradeState {
  const { data: config } = useAppConfig();

  const [state] = useState<UpgradeState>(() =>
    resolveUpgradeState({
      appVersion: getAppVersionWithBuild(),
      platformOS: Platform.OS,
      minSupportedVersion: config?.minSupportedVersion ?? DEFAULT_APP_CONFIG.minSupportedVersion,
      minAppVersion: config?.minAppVersion ?? DEFAULT_APP_CONFIG.minAppVersion,
      recommendedAppVersion: config?.recommendedAppVersion ?? DEFAULT_APP_CONFIG.recommendedAppVersion,
    }),
  );

  return state;
}
