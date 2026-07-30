import { useSegments } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { useUpsellStore } from "../billing/upsell-store";
import { useAppConfig } from "../config/app-config-queries";
import {
  defaultUpdatesApiLoader,
  runUpdateCycle,
  type UpdatesApiLoader,
} from "../ota/update-controller";
import { isDeferredFlow } from "../ota/update-deferral";
import { readLastCheckAt, shouldRecheck, writeLastCheckAt } from "../ota/update-throttle";

export interface UseUpdateFlowOverrides {
  loader?: UpdatesApiLoader;
  now?: () => number;
  timeoutMs?: number;
}

export interface UseUpdateFlowResult {
  promptVisible: boolean;
  restart(): void;
  dismiss(): void;
}

/**
 * T114: the in-app update flow (docs/OTA_UPDATES.md §3). Runs exactly one
 * check/fetch/critical-decision cycle at mount (cold start ALWAYS checks --
 * the 6h throttle is the *foreground re-check* rule only), and one more per
 * `AppState` "active" transition, throttled to once per 6h via the
 * persisted `update-throttle.ts` store. Every non-critical outcome is
 * silent (§3 S4) -- only a `"critical"` outcome ever sets local state.
 *
 * `promptVisible = pendingCritical && !dismissed && !deferred` IS the
 * deferral guard: `deferred` covers both route-derived protected flows
 * (`isDeferredFlow`) and the non-route `<UpsellSheet/>` purchase surface
 * (`useUpsellStore().visible`). A pending critical prompt simply re-appears
 * once the protected flow ends -- there is no separate "release" step.
 * `restart()` re-checks `deferred` at tap time (not just at render time), so
 * a race where the user enters a protected flow between render and tap
 * still cannot reload (CLAUDE.md §7 -- critical NEVER bypasses the guard).
 */
export function useUpdateFlow(overrides?: UseUpdateFlowOverrides): UseUpdateFlowResult {
  const segments = useSegments();
  const upsellVisible = useUpsellStore((state) => state.visible);
  const deferred = isDeferredFlow(segments) || upsellVisible;

  const { data: appConfig } = useAppConfig();
  const criticalOtaVersion = appConfig?.criticalOtaVersion ?? null;

  const loader = overrides?.loader ?? defaultUpdatesApiLoader;
  const now = overrides?.now ?? Date.now;
  const timeoutMs = overrides?.timeoutMs;

  const [pendingCritical, setPendingCritical] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const cycleInFlightRef = useRef(false);

  // Latest deps live in a ref so the mount-only effects below (both use `[]`
  // deps deliberately -- see their comments) always read the CURRENT
  // `criticalOtaVersion`/`loader`/`now`/`timeoutMs` rather than a stale
  // closure captured at first render.
  const depsRef = useRef({ loader, criticalOtaVersion, now, timeoutMs });
  depsRef.current = { loader, criticalOtaVersion, now, timeoutMs };

  async function runCycle() {
    if (cycleInFlightRef.current) {
      return;
    }
    cycleInFlightRef.current = true;
    try {
      const { loader: currentLoader, criticalOtaVersion: currentCritical, timeoutMs: currentTimeout } =
        depsRef.current;
      const outcome = await runUpdateCycle({
        loader: currentLoader,
        criticalOtaVersion: currentCritical,
        // `exactOptionalPropertyTypes`: only include `timeoutMs` when a
        // caller actually overrode it, rather than passing an explicit
        // `undefined` for the optional field.
        ...(currentTimeout === undefined ? {} : { timeoutMs: currentTimeout }),
      });
      if (outcome === "critical") {
        setPendingCritical(true);
      }
    } finally {
      cycleInFlightRef.current = false;
    }
  }

  // Cold-start cycle: fire-and-forget, exactly once per mount.
  useEffect(() => {
    void runCycle().finally(() => {
      writeLastCheckAt(depsRef.current.now());
    });
    // Deliberately mount-only: cold start always checks exactly once,
    // regardless of later config/loader changes (this repo has no
    // `react-hooks/exhaustive-deps` rule enabled, so no disable directive is
    // needed here).
  }, []);

  // Foreground re-check, throttled to once per 6h (persisted timestamp).
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        return;
      }
      const currentNow = depsRef.current.now();
      if (!shouldRecheck(currentNow, readLastCheckAt())) {
        return;
      }
      void runCycle().finally(() => {
        writeLastCheckAt(depsRef.current.now());
      });
    });

    return () => {
      subscription.remove();
    };
    // Deliberately mount-only, same rationale as the cold-start effect above.
  }, []);

  function restart() {
    // Tap-time re-guard (CLAUDE.md §7): re-checks `deferred` here, not just
    // at render time, so a race where the user enters a protected flow
    // between render and tap still cannot reload.
    if (deferred) {
      return;
    }
    void depsRef.current
      .loader()
      ?.reloadAsync?.()
      .catch(() => {
        // Best-effort; a reload failure must never crash the flow.
      });
  }

  function dismiss() {
    setDismissed(true);
  }

  return {
    promptVisible: pendingCritical && !dismissed && !deferred,
    restart,
    dismiss,
  };
}
