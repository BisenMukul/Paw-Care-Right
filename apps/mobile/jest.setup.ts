// @testing-library/react-native v13+ auto-registers its Jest matchers
// (toBeOnTheScreen, etc.) as soon as any test imports from the package —
// there is no longer a separate `/extend-expect` entry point to import
// here (that was the deprecated `@testing-library/jest-native` pattern).

// T024: `expo-image`'s `Image` component is mocked to `react-native`'s own
// `Image` so the wizard's photo preview/avatar renders headless. Imported
// under a `mock`-prefixed alias so babel-plugin-jest-hoist allows the
// jest.mock factory below (hoisted above this import) to reference it.
import { createElement as mockCreateElement, useRef as mockUseRef, type ReactNode } from "react";
import { Image as mockImage, Text as mockText, View as mockView } from "react-native";

// T018: global mocks for the native modules the auth flow touches, so any
// test importing a screen/store/component works headless (no device/
// emulator/Expo Go in this container). Individual tests may override the
// jest.fn() return values with `mockResolvedValueOnce`/`mockReturnValueOnce`.

// expo-secure-store — an in-memory map standing in for the OS keychain.
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

// expo-notifications — permission + push-token stubs.
jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  getExpoPushTokenAsync: jest.fn(async () => ({
    data: "ExponentPushToken[test-token]",
  })),
}));

// expo-apple-authentication — unavailable by default (opt-in per test).
jest.mock("expo-apple-authentication", () => ({
  isAvailableAsync: jest.fn(async () => false),
  signInAsync: jest.fn(async () => ({ identityToken: "test-apple-token" })),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

// expo-auth-session/providers/google — request/response/promptAsync stubs.
jest.mock("expo-auth-session/providers/google", () => ({
  useAuthRequest: jest.fn(() => [{}, null, jest.fn()]),
}));

// expo-web-browser — no-op in headless tests.
jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(async () => ({ type: "dismiss" })),
}));

// react-native-mmkv (T019) — the native module never loads in this
// container; a tiny in-memory map stands in for it so any test that
// transitively imports `src/api/query.ts` (the root layout) stays headless.
jest.mock("react-native-mmkv", () => {
  const store = new Map<string, string>();
  return {
    createMMKV: jest.fn(() => ({
      getString: jest.fn((key: string) => store.get(key)),
      set: jest.fn((key: string, value: string) => {
        store.set(key, value);
      }),
      remove: jest.fn((key: string) => {
        store.delete(key);
      }),
    })),
  };
});

// expo-network (T019) — reports "always online" by default; individual
// tests may override with `mockResolvedValueOnce`/`mockReturnValueOnce`.
jest.mock("expo-network", () => ({
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// expo-image-picker (T024, camera fns added T046) — granted permission + a
// single non-canceled asset by default; individual tests may override with
// `mockResolvedValueOnce`.
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: "file:///pick.jpg", width: 2000, height: 1500 }],
  })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  launchCameraAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: "file:///camera.jpg", width: 2000, height: 1500 }],
  })),
}));

// expo-image-manipulator (T024) — the new, contextual `manipulate(...)` API
// (SDK 57 has no legacy `manipulateAsync`, see `src/pets/compress-image.ts`).
// `resize` is chainable (returns the same context); `renderAsync` yields an
// object whose `saveAsync` resolves the compressed-image stand-in.
jest.mock("expo-image-manipulator", () => {
  const saveAsync = jest.fn(async () => ({ uri: "file:///out.jpg", width: 1600, height: 1200 }));
  const renderAsync = jest.fn(async () => ({ saveAsync }));
  const context: { resize: jest.Mock; renderAsync: jest.Mock } = {
    resize: jest.fn(() => context),
    renderAsync,
  };
  return {
    ImageManipulator: { manipulate: jest.fn(() => context) },
    SaveFormat: { JPEG: "jpeg", PNG: "png", WEBP: "webp" },
  };
});

// expo-image (T024) — a passthrough stand-in for the native `Image` view.
jest.mock("expo-image", () => ({ Image: mockImage }));

// react-native-svg (T065) — the real native module never loads under jest;
// each named export becomes a passthrough host component (stable tag,
// props/children rendered through unchanged) so `<Svg>`/`<Path>`/etc.
// snapshot deterministically. Default export is `Svg` itself, mirroring
// the real package's `import Svg, { G, Path, ... } from "react-native-svg"`.
// `Text`'s underlying host is the REAL `react-native` `Text` (not a bare
// string tag) — react-native-svg's `<Text>` is the one element that holds
// raw string children, and RNTL's host-component allowlist only permits
// that under a real `Text` view, not an arbitrary custom tag.
jest.mock("react-native-svg", () => {
  function passthrough(tag: string) {
    return function MockSvgComponent(props: { children?: ReactNode; [key: string]: unknown }) {
      const { children, ...rest } = props;
      return mockCreateElement(tag, rest, children);
    };
  }
  function textPassthrough() {
    return function MockSvgText(props: { children?: ReactNode; [key: string]: unknown }) {
      const { children, ...rest } = props;
      return mockCreateElement(mockText, rest, children);
    };
  }
  const Svg = passthrough("mock-svg");
  const G = passthrough("mock-svg-g");
  const Path = passthrough("mock-svg-path");
  const Line = passthrough("mock-svg-line");
  const Rect = passthrough("mock-svg-rect");
  const Circle = passthrough("mock-svg-circle");
  const Text = textPassthrough();
  return { __esModule: true, default: Svg, Svg, G, Path, Line, Rect, Circle, Text };
});

// react-native-reanimated (founder home UI overhaul) — the package's own
// documented jest mock (`react-native-reanimated/mock`) transitively
// `require`s the real `react-native-worklets` native bridge
// (`NativeWorklets.native.ts`'s `loadUnpackers`), which throws under this
// repo's jest environment (no native module registered) — a known
// incompatibility between reanimated 4's split-out worklets package and its
// classic mock. A minimal hand-rolled mock stands in instead, covering only
// the subset of the real API this codebase actually uses (`Animated.View`,
// `FadeInDown`'s chainable `.delay()/.duration()` builder, `Easing`,
// `useSharedValue`, `useAnimatedStyle`, `withRepeat`, `withTiming`) — every
// animation resolves synchronously/instantly so components render
// deterministically and headless, same goal as the package's own mock.
//
// Every helper below is declared at MODULE scope (not inside the
// `jest.mock` factory) and referenced only via the single `mock`-prefixed
// `mockReanimatedModule` binding -- babel-plugin-jest-hoist's static scope
// check only allows `mock`-prefixed identifiers to cross into a hoisted
// factory, and (unlike a nested TS `interface`) a plain top-level
// declaration sidesteps its AST walk entirely.
function mockUseSharedValue<T>(initial: T): { value: T } {
  return mockUseRef({ value: initial }).current;
}

function mockUseAnimatedStyle<T>(factory: () => T): T {
  return factory();
}

function mockWithTiming<T>(toValue: T): T {
  return toValue;
}

function mockWithRepeat<T>(animation: T): T {
  return animation;
}

interface MockEnteringAnimationBuilder {
  delay: (ms: number) => MockEnteringAnimationBuilder;
  duration: (ms: number) => MockEnteringAnimationBuilder;
}

function mockMakeEnteringAnimationBuilder(): MockEnteringAnimationBuilder {
  const builder: MockEnteringAnimationBuilder = {
    delay: () => builder,
    duration: () => builder,
  };
  return builder;
}

const mockEasing = {
  inOut: (fn: (t: number) => number) => fn,
  ease: (t: number) => t,
  linear: (t: number) => t,
};

// SWEEP-1: the reduced-motion contract's mocks. `useReducedMotion` defaults
// to `false` so every existing entrance/snapshot stays byte-identical
// (design-system.md §3.2 risk note); individual tests override via
// `jest.requireMock("react-native-reanimated").useReducedMotion`.
// `ReducedMotionConfig` is a no-op `() => null` so mounting it in the root
// layout never changes any rendered tree.
const mockUseReducedMotion = jest.fn(() => false);

const mockReanimatedModule = {
  __esModule: true,
  default: { View: mockView },
  FadeInDown: mockMakeEnteringAnimationBuilder(),
  Easing: mockEasing,
  useSharedValue: mockUseSharedValue,
  useAnimatedStyle: mockUseAnimatedStyle,
  withRepeat: mockWithRepeat,
  withTiming: mockWithTiming,
  useReducedMotion: mockUseReducedMotion,
  ReducedMotionConfig: () => null,
  ReduceMotion: { System: "system", Always: "always", Never: "never" },
};

jest.mock("react-native-reanimated", () => mockReanimatedModule);

// expo-linear-gradient (founder home UI overhaul) — the real native view
// (`requireNativeViewManager`) never loads under jest; the same
// passthrough `View` stand-in (mirrors this file's other native-view
// mocks, e.g. `react-native-svg` below) keeps the animated gradient
// background headless.
const mockLinearGradientModule = { LinearGradient: mockView };
jest.mock("expo-linear-gradient", () => mockLinearGradientModule);

// react-native-purchases (T071) — the native module never loads in this
// container; a stub default export keeps any transitive import (e.g.
// `_layout`'s `usePurchasesInit`) headless. The "native absent" no-op path
// itself is tested by injecting a null loader into `src/billing/purchases.ts`
// (not by relying on this mock), so this stub only needs to prevent the real
// `require` from throwing.
jest.mock("react-native-purchases", () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    logIn: jest.fn(async () => ({})),
    logOut: jest.fn(async () => ({})),
  },
}));

// expo-haptics (founder-directed activity log, `src/haptics.ts`) — the
// native module never loads in this container; jest.fn() stand-ins so
// `haptics.selection()`/`haptics.success()` resolve headless. Individual
// tests may assert on these mocks via `jest.requireMock`.
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

// expo-font (PAWSAATHI-1 plan): the real native font loader never runs
// under jest -- `useFonts` is deterministically "already loaded" by
// default so every screen renders headless without gating on it. Tests
// that specifically exercise the pending/failure states (`fonts-
// nonblocking.test.tsx`) override this per-test with
// `mockReturnValueOnce`/`mockReturnValue`.
jest.mock("expo-font", () => ({
  useFonts: jest.fn(() => [true, null]),
  loadAsync: jest.fn(async () => undefined),
  isLoaded: jest.fn(() => true),
}));

export {};
