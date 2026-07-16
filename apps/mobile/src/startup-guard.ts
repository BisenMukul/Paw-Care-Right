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
 * chained afterwards -- this trap observes, it never swallows.
 */

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
    // eslint-disable-next-line no-console -- JUSTIFIED: last-resort startup-crash diagnostic; fires only when the app is already going down and must reach Metro/adb logs (Sentry wiring lands in P9)
    console.error(`[pawcareright startup] ${isFatal === true ? "FATAL" : "non-fatal"} JS error:`, error);
    previousHandler?.(error, isFatal);
  });
}

/** Test-only: allows re-installation across jest module resets. */
export function __resetStartupGuardForTest(): void {
  installed = false;
}

installStartupGuard();
