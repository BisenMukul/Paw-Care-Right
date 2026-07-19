import * as ReactNative from "react-native";

/**
 * RESPONSIVE-1 plan D1/D2: a `useWindowDimensions`-based responsive bucket,
 * NOT NativeWind `sm:/md:/lg:` breakpoints. Under this workspace's jest
 * (NativeWind 4.2.6 + the `.css` stub), `className` is kept as an
 * un-resolved literal prop (PAWSAATHI-1 R3) -- a `md:` prefix would be an
 * inert, unverifiable string. A hook is spy-testable exactly like
 * `home-gradient-scheme.test.tsx` spies `useColorScheme`
 * (`jest.spyOn(ReactNative, "useWindowDimensions")`), and a layout branch
 * keyed on the hook produces different `className`/structure that IS
 * observable in `toJSON()`.
 *
 * The `import * as ReactNative` namespace form (rather than a destructured
 * `import { useWindowDimensions }`) is required here, verified empirically:
 * under this workspace's babel/jest transform, a named-import binding to
 * `react-native`'s `useWindowDimensions` resolved in a module OTHER than the
 * spying test file does not observe a later `jest.spyOn(ReactNative,
 * "useWindowDimensions")` override (the call still returns the real,
 * un-mocked dimensions) -- while the identical spy DOES take effect through
 * a namespace-qualified `ReactNative.useWindowDimensions()` call. Calling
 * through the namespace object at each invocation keeps the property access
 * live, so the spy is observed regardless of which file defines the hook.
 *
 * Thresholds (D2): `compact` < 360, `regular` 360-767, `wide` >= 768. The
 * `wide` >= 768 boundary is the classic phone<->tablet line. Chosen
 * deliberately so jest's default window width (750, from
 * `@react-native/jest-preset`'s `DeviceInfo` mock) resolves to `regular` --
 * every responsive change this task makes is additive-conditional (only the
 * `wide` branch adds classes/structure), so the four pinned snapshots stay
 * byte-identical through the unchanged `regular` path (D3).
 */
export type LayoutBucket = "compact" | "regular" | "wide";

export const LAYOUT_COMPACT_MAX = 360; // width < 360  => compact (tiny/small phones incl. 320 SE)
export const LAYOUT_WIDE_MIN = 768; // width >= 768 => wide (tablets & large-landscape); 750 jest-default stays regular

export function bucketForWidth(width: number): LayoutBucket {
  if (width >= LAYOUT_WIDE_MIN) return "wide";
  if (width < LAYOUT_COMPACT_MAX) return "compact";
  return "regular";
}

export function useLayoutBucket(): LayoutBucket {
  return bucketForWidth(ReactNative.useWindowDimensions().width);
}
