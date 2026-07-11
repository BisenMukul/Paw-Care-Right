// AC3 — tokens are persisted ONLY via `expo-secure-store`, never
// `@react-native-async-storage/async-storage`. `expo-secure-store` is
// mocked globally (in-memory map, `jest.setup.ts`). `global.fetch` is
// mocked here to drive the real `useAuthStore` -> `authApi` -> `apiClient`
// chain end-to-end without a real network call.
//
// `apiClient` binds its `fetch` implementation once, at module-eval time
// (`createApiClient` reads `globalThis.fetch` when the module-level
// `apiClient` singleton in `src/api/client.ts` is constructed). So
// `global.fetch` must be assigned *before* that module (transitively
// imported by `useAuthStore`) is first evaluated — `jest.resetModules()` +
// a fresh `require()` after setting the mock achieves that per test.
describe("token storage (AC3)", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("persists both tokens to SecureStore (and only SecureStore) after a successful verify", async () => {
    const tokens = {
      accessToken: "access-token-value",
      refreshToken: "refresh-token-value",
      user: { id: "user-1", email: "a@b.com" },
      householdId: "household-1",
    };

    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(tokens),
    }) as unknown as typeof fetch;

    // Runtime require() (not import) is required here: after
    // jest.resetModules() only a CJS require re-evaluates the module graph
    // so the fetch mock above is bound; jest-expo's babel config does not
    // support dynamic import in the jest VM.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SecureStore = require("expo-secure-store") as typeof import("expo-secure-store");
    const { useAuthStore } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("../src/auth/auth-store") as typeof import("../src/auth/auth-store");

    await useAuthStore.getState().verifyOtp("a@b.com", "123456");

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "pawcareright.auth.accessToken",
      tokens.accessToken,
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "pawcareright.auth.refreshToken",
      tokens.refreshToken,
    );
    expect(await SecureStore.getItemAsync("pawcareright.auth.accessToken")).toBe(
      tokens.accessToken,
    );
    expect(await SecureStore.getItemAsync("pawcareright.auth.refreshToken")).toBe(
      tokens.refreshToken,
    );
  });

  it("cannot resolve @react-native-async-storage/async-storage — it is not a declared dependency", () => {
    // Under pnpm's strict node_modules isolation, an undeclared package is
    // unresolvable from this workspace. This proves the app has no code
    // path that could reach for AsyncStorage — SecureStore is the only
    // option available to import.
    expect(() =>
      jest.requireActual("@react-native-async-storage/async-storage"),
    ).toThrow();
  });
});
