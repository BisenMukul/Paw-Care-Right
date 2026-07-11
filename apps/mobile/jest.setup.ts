// @testing-library/react-native v13+ auto-registers its Jest matchers
// (toBeOnTheScreen, etc.) as soon as any test imports from the package —
// there is no longer a separate `/extend-expect` entry point to import
// here (that was the deprecated `@testing-library/jest-native` pattern).

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

export {};
