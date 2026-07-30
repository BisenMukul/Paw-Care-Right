/**
 * T113 carry-forward F3: nothing previously pinned the lazy-require idiom
 * shared by `observability/ota-info.ts` (T113) and `ota/update-controller.ts`
 * (T114) -- both must tolerate `require("expo-updates")` THROWING (a real
 * Expo Go / jest-container failure mode), not just returning `null`. This
 * test throws from the mocked module itself, then asserts BOTH modules can
 * still be imported without throwing, and that their public functions
 * resolve to the documented safe-fallback shapes. It fails the moment
 * either module moves `expo-updates` to a top-level `import` (which would
 * throw at import time, before any try/catch could run).
 */
jest.mock("expo-updates", () => {
  throw new Error("native binding unavailable");
});

describe("ota-lazy-require: importing the OTA modules never eagerly requires expo-updates", () => {
  it("imports src/observability/ota-info.ts without throwing", () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: this test must exercise the module's OWN internal require of "expo-updates" (mocked to throw above), which can only be observed via a runtime require here too, not a top-level import
      require("../src/observability/ota-info");
    }).not.toThrow();
  });

  it("readOtaInfo() resolves to the all-absent shape when the native module throws on load", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: same as above
    const { readOtaInfo } = require("../src/observability/ota-info") as typeof import("../src/observability/ota-info");

    expect(readOtaInfo()).toEqual({
      isEnabled: false,
      updateId: null,
      channel: null,
      runtimeVersion: null,
      isEmbeddedLaunch: true,
    });
  });

  it("imports src/ota/update-controller.ts without throwing", () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: same as above
      require("../src/ota/update-controller");
    }).not.toThrow();
  });

  it("runUpdateCycle() resolves 'disabled' (never throws) when the native module throws on load", async () => {
    const { runUpdateCycle } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: same as above
      require("../src/ota/update-controller") as typeof import("../src/ota/update-controller");

    await expect(runUpdateCycle({ criticalOtaVersion: null })).resolves.toBe("disabled");
  });
});
