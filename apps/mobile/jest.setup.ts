// @testing-library/react-native v13+ auto-registers its Jest matchers
// (toBeOnTheScreen, etc.) as soon as any test imports from the package —
// there is no longer a separate `/extend-expect` entry point to import
// here (that was the deprecated `@testing-library/jest-native` pattern).

// T024: `expo-image`'s `Image` component is mocked to `react-native`'s own
// `Image` so the wizard's photo preview/avatar renders headless. Imported
// under a `mock`-prefixed alias so babel-plugin-jest-hoist allows the
// jest.mock factory below (hoisted above this import) to reference it.
import { createElement as mockCreateElement, type ReactNode } from "react";
import { Image as mockImage, Text as mockText } from "react-native";

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

export {};
