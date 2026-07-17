import { requireOptionalNativeModule } from "expo";

/**
 * Availability probe for `expo-linear-gradient`'s NATIVE view (founder
 * hotfix): a dev client built before the dependency was added has the JS
 * package (Metro serves it) but NOT the native ViewManager -- mounting
 * `<LinearGradient/>` then hard-crashes Fabric with "Can't find
 * ViewManager 'ExpoLinearGradient'". Probe the native module registry
 * up front and let callers fall back to a plain background instead.
 *
 * Isolated in its own module so tests can mock availability both ways.
 */
export function isNativeGradientAvailable(): boolean {
  try {
    return requireOptionalNativeModule("ExpoLinearGradient") != null;
  } catch {
    // Any resolution surprise (bare jest/node) counts as unavailable --
    // the fallback background is always safe to render.
    return false;
  }
}
