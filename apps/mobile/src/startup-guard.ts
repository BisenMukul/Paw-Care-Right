/**
 * Startup crash trap (founder hotfix): converts silent crash-after-splash
 * failures into diagnosable logs. React error boundaries only catch RENDER
 * errors inside the tree that mounted them -- a throw during module
 * evaluation or in a native callback kills the app with no UI and no trace
 * in the Metro console. Installing a chained global handler as the FIRST
 * import of the root layout guarantees every fatal JS error is logged with
 * its stack before React Native tears down, so "app crashes on Expo" turns
 * into an actionable stack trace in `expo start` / adb logcat.
 *
 * The previous handler (React Native's own red-box/dev handler) is always
 * chained afterwards -- this trap observes, it never swallows. T089 also
 * forwards every trapped error to Sentry via `captureError` (a safe no-op
 * until `initMobileSentry()` has run, e.g. before the root layout's Sentry
 * wiring executes -- see `app/_layout.tsx`).
 */

import { recordLogEvent } from "./observability/log-buffer";
import { captureError } from "./observability/sentry";

/** Bare error-class name only (e.g. `TypeError`) when `error` is an `Error` -- never a message/stack (T104 D3). */
function safeErrorName(error: unknown): string | undefined {
  return error instanceof Error ? error.name : undefined;
}

interface ErrorUtilsLike {
  getGlobalHandler(): ((error: unknown, isFatal?: boolean) => void) | undefined;
  setGlobalHandler(handler: (error: unknown, isFatal?: boolean) => void): void;
}

function resolveErrorUtils(): ErrorUtilsLike | undefined {
  const candidate = (globalThis as { ErrorUtils?: unknown }).ErrorUtils;
  if (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof (candidate as ErrorUtilsLike).getGlobalHandler === "function" &&
    typeof (candidate as ErrorUtilsLike).setGlobalHandler === "function"
  ) {
    return candidate as ErrorUtilsLike;
  }
  return undefined;
}

let installed = false;

export function installStartupGuard(): void {
  if (installed) {
    return;
  }
  const errorUtils = resolveErrorUtils();
  if (errorUtils === undefined) {
    // Non-RN environment (bare jest/node) -- nothing to install, never throw.
    return;
  }
  installed = true;

  const previousHandler = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    // eslint-disable-next-line no-console -- JUSTIFIED: last-resort startup-crash diagnostic; fires only when the app is already going down and must reach Metro/adb logs (Sentry wiring landed T089 -- captureError below is a safe no-op when uninitialized, e.g. before `initMobileSentry()` has run)
    console.error(`[bombaypetcompany startup] ${isFatal === true ? "FATAL" : "non-fatal"} JS error:`, error);
    captureError(error, { isFatal: isFatal === true });
    // T104: feeds the closed-shape feedback log-buffer (D3) -- never the
    // error's message/stack, only its bare class name.
    const errorName = safeErrorName(error);
    recordLogEvent({
      level: "error",
      code: isFatal === true ? "startup_fatal" : "startup_nonfatal",
      ...(errorName !== undefined ? { errorName } : {}),
    });
    previousHandler?.(error, isFatal);
  });
}

/** Test-only: allows re-installation across jest module resets. */
export function __resetStartupGuardForTest(): void {
  installed = false;
}

installStartupGuard();
