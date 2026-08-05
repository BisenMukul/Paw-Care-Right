import { useSegments } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { captureEvent } from "../analytics/analytics";
import { useAuthStore } from "../auth/auth-store";
import { useUpsellStore } from "../billing/upsell-store";
import { useAppConfig } from "../config/app-config-queries";
import { readOtaInfo } from "../observability/ota-info";
import {
  defaultUpdatesApiLoader,
  runUpdateCycle,
  type OtaCycleEvent,
  type UpdatesApiLoader,
} from "../ota/update-controller";
import { isDeferredFlow } from "../ota/update-deferral";
import { clearPendingApplied, computeAppliedEvent, readPendingApplied, writePendingApplied } from "../ota/ota-telemetry";
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

  // T117 step 9: the OTA telemetry event callback (D3). Stays a plain
  // function (not passed through `depsRef`) since it closes over `now` via
  // `depsRef.current.now()` at call time, not at effect-registration time.
  function handleOtaCycleEvent(event: OtaCycleEvent): void {
    if (event.kind === "available") {
      captureEvent("ota_available", { channel: event.channel, currentUpdateId: event.currentUpdateId });
      return;
    }

    // "downloaded": emit the event AND persist a "pending applied" record
    // (D2) so `ota_applied` can still be reported later even if the app is
    // signed out right now.
    captureEvent("ota_downloaded", {
      channel: event.channel,
      currentUpdateId: event.currentUpdateId,
      critical: event.critical,
    });
    writePendingApplied({ fromUpdateId: event.currentUpdateId, downloadedAtMs: depsRef.current.now() });
  }

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
        onEvent: handleOtaCycleEvent,
      });
      if (outcome === "critical") {
        setPendingCritical(true);
      }
    } finally {
      cycleInFlightRef.current = false;
    }
  }

  // T117 step 9: fires the deferred `ota_applied` event (D2) once per
  // mount, if a pending "downloaded" record exists, the app actually
  // launched on a DIFFERENT updateId than the one it was pending from (a
  // real apply, not just a re-check), and a user is signed in right now
  // (`captureEvent` itself no-ops without one -- this check just avoids
  // computing/discarding the event pointlessly). A signed-out apply leaves
  // the record in place for the next signed-in launch to pick up.
  useEffect(() => {
    const { updateId: currentUpdateId } = readOtaInfo();
    const pending = readPendingApplied();
    const applied = computeAppliedEvent({ current: currentUpdateId, pending, nowMs: depsRef.current.now() });

    if (applied === null) {
      return;
    }

    if (useAuthStore.getState().user === null) {
      return;
    }

    captureEvent("ota_applied", applied);
    clearPendingApplied();
    // Deliberately mount-only, same rationale as the cycle effects below.
  }, []);

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
