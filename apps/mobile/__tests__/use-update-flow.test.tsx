import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AppState } from "react-native";

import { useUpdateFlow } from "../src/hooks/use-update-flow";
import { useAuthStore } from "../src/auth/auth-store";
import { useUpsellStore } from "../src/billing/upsell-store";
import { useConsentStore } from "../src/analytics/consent-store";
import { clearPendingApplied, readPendingApplied, writePendingApplied } from "../src/ota/ota-telemetry";
import type { UpdatesUpdateApi } from "../src/ota/update-controller";

/**
 * T114 AC2/AC3 wiring: the deferral guard proving no reload prompt during
 * an in-progress check flow, and the foreground re-check throttle wired to
 * `AppState`. `useSegments` is mocked so each test controls the current
 * route; `useAppConfig` is mocked (mirrors `update-gate.test.tsx`) so
 * `criticalOtaVersion` is directly controllable without a QueryClient.
 *
 * T117 step 10 addendum: `../src/config` is mocked with a NON-empty
 * `posthogKey` (the `analytics-consent.test.ts` idiom) so the real
 * `createHttpTransport` -- not stub-safe-no-op'd -- actually reaches
 * `fetch`, letting the `ota_*` telemetry describe block below assert the
 * events reach the transport, not just that `captureEvent` was called.
 */
let mockSegments: (string | undefined)[] = ["(tabs)"];

jest.mock("expo-router", () => ({
  useSegments: () => mockSegments,
}));

const mockUseAppConfig = jest.fn();

jest.mock("../src/config/app-config-queries", () => ({
  useAppConfig: () => mockUseAppConfig(),
}));

jest.mock("../src/config", () => ({
  getConfig: () => ({
    apiBaseUrl: "http://localhost:3000",
    googleClientId: "",
    revenueCatIosKey: "stub_ios_key",
    revenueCatAndroidKey: "stub_android_key",
    termsUrl: "https://bombaypetcompany.app/terms",
    privacyUrl: "https://bombaypetcompany.app/privacy",
    posthogKey: "phc_test_key",
    posthogHost: "https://us.i.posthog.com",
  }),
  getAppVersion: () => "1.0.0",
}));

// Return type is deliberately `() => UpdatesUpdateApi` (never null) here,
// narrower than the public `UpdatesApiLoader` (`() => UpdatesUpdateApi |
// null`) that `useUpdateFlow` accepts -- a function that never returns
// `null` is assignable wherever a nullable-returning loader is expected, and
// keeping the LOCAL type non-null lets every test read `loader()` back
// without a redundant null-check.
function criticalLoader(): () => UpdatesUpdateApi {
  const api: UpdatesUpdateApi = {
    isEnabled: true,
    checkForUpdateAsync: jest.fn(async () => ({ isAvailable: true })),
    fetchUpdateAsync: jest.fn(async () => ({
      isNew: true,
      manifest: { extra: { updateMessage: "hotfix [critical]" } },
    })),
    reloadAsync: jest.fn(async () => undefined),
  };
  return () => api;
}

function silentLoader(): () => UpdatesUpdateApi {
  const api: UpdatesUpdateApi = {
    isEnabled: true,
    checkForUpdateAsync: jest.fn(async () => ({ isAvailable: true })),
    fetchUpdateAsync: jest.fn(async () => ({ isNew: true, manifest: {} })),
    reloadAsync: jest.fn(async () => undefined),
  };
  return () => api;
}

/** No update available -- the cold-start cycle resolves to "none" and never writes/overwrites a pending-applied record. */
function noUpdateLoader(): () => UpdatesUpdateApi {
  const api: UpdatesUpdateApi = {
    isEnabled: true,
    checkForUpdateAsync: jest.fn(async () => ({ isAvailable: false })),
    fetchUpdateAsync: jest.fn(async () => ({ isNew: false })),
    reloadAsync: jest.fn(async () => undefined),
  };
  return () => api;
}

function pendingLoader(): { loader: () => UpdatesUpdateApi; resolve: () => void } {
  let resolveCheck: (v: { isAvailable: boolean }) => void = () => {};
  const checkForUpdateAsync = jest.fn(
    () =>
      new Promise<{ isAvailable: boolean }>((resolve) => {
        resolveCheck = resolve;
      }),
  );
  const api: UpdatesUpdateApi = {
    isEnabled: true,
    checkForUpdateAsync,
    fetchUpdateAsync: jest.fn(async () => ({ isNew: false })),
    reloadAsync: jest.fn(async () => undefined),
  };
  return {
    loader: () => api,
    resolve: () => resolveCheck({ isAvailable: false }),
  };
}

describe("useUpdateFlow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSegments = ["(tabs)"];
    mockUseAppConfig.mockReturnValue({ data: { criticalOtaVersion: null } });
    useUpsellStore.setState({ visible: false });
  });

  it("returns immediately with no prompt while the cold-start check is still pending (AC1a non-blocking)", async () => {
    const { loader } = pendingLoader();

    // Short timeout so the background cycle settles quickly instead of
    // leaving a ~3s real timer running past this test.
    const { result, unmount } = await renderHook(() => useUpdateFlow({ loader, timeoutMs: 10 }));

    expect(result.current.promptVisible).toBe(false);
    await unmount();
  });

  it("shows the Update ready prompt after a critical outcome outside any protected flow (AC1b)", async () => {
    const loader = criticalLoader();

    const { result } = await renderHook(() => useUpdateFlow({ loader }));

    await waitFor(() => {
      expect(result.current.promptVisible).toBe(true);
    });

    await act(async () => {
      result.current.restart();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(loader().reloadAsync).toHaveBeenCalledTimes(1);
    });
  });

  it("never surfaces a prompt for a non-critical update (AC1c)", async () => {
    const loader = silentLoader();
    const api = loader();

    const { result } = await renderHook(() => useUpdateFlow({ loader }));

    await waitFor(() => {
      expect(api.fetchUpdateAsync).toHaveBeenCalled();
    });

    expect(result.current.promptVisible).toBe(false);
  });

  it("never shows the prompt during an in-progress symptom check, and never reloads if restart is invoked there (AC2)", async () => {
    mockSegments = ["check", "waiting", "[checkId]"];
    const loader = criticalLoader();
    const api = loader();

    const { result } = await renderHook(() => useUpdateFlow({ loader }));

    await waitFor(() => {
      expect(api.fetchUpdateAsync).toHaveBeenCalled();
    });

    expect(result.current.promptVisible).toBe(false);

    await act(async () => {
      result.current.restart();
      await Promise.resolve();
    });

    expect(api.reloadAsync).not.toHaveBeenCalled();
  });

  it.each([
    ["Emergency interstitial", ["check", "emergency", "[checkId]"]],
    ["paywall/checkout", ["paywall"]],
    ["onboarding (auth)", ["(auth)", "otp"]],
    ["onboarding add-pet", ["add-pet", "species"]],
    ["push-rationale", ["push-rationale"]],
  ])("defers over %s", async (_name, segments) => {
    mockSegments = segments;
    const loader = criticalLoader();
    const api = loader();

    const { result } = await renderHook(() => useUpdateFlow({ loader }));

    await waitFor(() => {
      expect(api.fetchUpdateAsync).toHaveBeenCalled();
    });

    expect(result.current.promptVisible).toBe(false);
  });

  it("defers over the non-route upsell purchase sheet", async () => {
    mockSegments = ["(tabs)"];
    useUpsellStore.setState({ visible: true });
    const loader = criticalLoader();
    const api = loader();

    const { result } = await renderHook(() => useUpdateFlow({ loader }));

    await waitFor(() => {
      expect(api.fetchUpdateAsync).toHaveBeenCalled();
    });

    expect(result.current.promptVisible).toBe(false);
  });

  it("surfaces the deferred prompt once the protected flow completes, with no second cycle", async () => {
    mockSegments = ["check", "index"];
    const loader = criticalLoader();
    const api = loader();

    const { result, rerender } = await renderHook(() => useUpdateFlow({ loader }));

    await waitFor(() => {
      expect(api.fetchUpdateAsync).toHaveBeenCalledTimes(1);
    });

    expect(result.current.promptVisible).toBe(false);

    mockSegments = ["(tabs)"];
    rerender({});

    await waitFor(() => {
      expect(result.current.promptVisible).toBe(true);
    });
    expect(api.checkForUpdateAsync).toHaveBeenCalledTimes(1);
  });

  it("re-checks on foreground only once per 6h", async () => {
    let currentTime = 0;
    const now = () => currentTime;
    const loader = silentLoader();
    const api = loader();
    let listener: ((state: string) => void) | undefined;
    const removeSpy = jest.fn();
    const addEventListenerSpy = jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, cb) => {
        listener = cb as (state: string) => void;
        return { remove: removeSpy };
      });

    const { unmount } = await renderHook(() => useUpdateFlow({ loader, now }));

    await waitFor(() => {
      expect(api.checkForUpdateAsync).toHaveBeenCalledTimes(1);
    });

    // First "active" transition, still within the 6h window (no time has
    // passed since the cold-start check) -- must NOT trigger a re-check.
    await act(async () => {
      listener?.("active");
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(api.checkForUpdateAsync).toHaveBeenCalledTimes(1);
    });

    // Advance past the 6h throttle window, then a second "active" event
    // triggers exactly one more cycle.
    currentTime += 6 * 60 * 60 * 1000 + 1;
    await act(async () => {
      listener?.("active");
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(api.checkForUpdateAsync).toHaveBeenCalledTimes(2);
    });

    await unmount();
    expect(removeSpy).toHaveBeenCalledTimes(1);
    addEventListenerSpy.mockRestore();
  });
});

// T117 step 10 (AC "ota events fire in mocked flow tests"): real
// `createAnalytics` + `fetch`-spy, mirroring `analytics-consent.test.ts`.
// The global `expo-updates` jest mock (`jest.setup.ts`) reports
// `updateId: null`/`channel: null` throughout this file, so every event
// below asserts against those fixed values.
describe("useUpdateFlow — ota_* telemetry (T117)", () => {
  let fetchSpy: jest.Mock;
  const originalFetch = globalThis.fetch;

  function capturedEvents(): { event: string; properties: Record<string, unknown> }[] {
    return fetchSpy.mock.calls.map(([, init]: [string, RequestInit]) => {
      const body = JSON.parse(init.body as string) as { event: string; properties: Record<string, unknown> };
      return { event: body.event, properties: body.properties };
    });
  }

  let addEventListenerSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    useConsentStore.setState({ enabled: true });
    clearPendingApplied();
    mockSegments = ["(tabs)"];
    mockUseAppConfig.mockReturnValue({ data: { criticalOtaVersion: null } });
    useUpsellStore.setState({ visible: false });
    // Mirrors the pre-existing "re-checks on foreground" test's idiom: a
    // real `remove()` handle so implicit unmount (RTL's automatic per-test
    // cleanup) never throws.
    addEventListenerSpy = jest.spyOn(AppState, "addEventListener").mockImplementation(() => ({
      remove: jest.fn(),
    }));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    useAuthStore.setState({ user: null });
    clearPendingApplied();
    addEventListenerSpy.mockRestore();
  });

  it("signed-in + consent on: ota_available and ota_downloaded reach the transport with §7's property names", async () => {
    useAuthStore.setState({ user: { id: "user-1", email: "user@example.com" } });
    const loader = silentLoader();
    const api = loader();

    await renderHook(() => useUpdateFlow({ loader }));

    await waitFor(() => {
      expect(api.fetchUpdateAsync).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(capturedEvents().some((e) => e.event === "ota_downloaded")).toBe(true);
    });

    const events = capturedEvents();
    expect(events).toContainEqual({
      event: "ota_available",
      properties: { channel: null, currentUpdateId: null },
    });
    expect(events).toContainEqual({
      event: "ota_downloaded",
      properties: { channel: null, currentUpdateId: null, critical: false },
    });
  });

  it("signed-in: a pending applied record from a prior update fires ota_applied and is then cleared", async () => {
    useAuthStore.setState({ user: { id: "user-1", email: "user@example.com" } });
    writePendingApplied({ fromUpdateId: "old-update-id", downloadedAtMs: 1000 });
    // Deliberately a "no update available" loader (not `silentLoader`): a
    // fresh "downloaded" event in the SAME cold-start cycle would write its
    // own new pending record right after this test's applied-clear, which
    // would defeat the "and is then cleared" assertion below for reasons
    // unrelated to what this test is proving.
    const loader = noUpdateLoader();

    await renderHook(() => useUpdateFlow({ loader, now: () => 1500 }));

    await waitFor(() => {
      expect(capturedEvents().some((e) => e.event === "ota_applied")).toBe(true);
    });

    expect(capturedEvents()).toContainEqual({
      event: "ota_applied",
      properties: { updateId: null, fromUpdateId: "old-update-id", latencyMs: 500 },
    });
    expect(readPendingApplied()).toBeNull();
  });

  it("signed-out: ota_applied is NOT emitted and the pending record survives", async () => {
    useAuthStore.setState({ user: null });
    writePendingApplied({ fromUpdateId: "old-update-id", downloadedAtMs: 1000 });
    const loader = noUpdateLoader();
    const api = loader();

    await renderHook(() => useUpdateFlow({ loader, now: () => 1500 }));

    await waitFor(() => {
      expect(api.checkForUpdateAsync).toHaveBeenCalled();
    });

    expect(capturedEvents().some((e) => e.event === "ota_applied")).toBe(false);
    expect(readPendingApplied()).toEqual({ fromUpdateId: "old-update-id", downloadedAtMs: 1000 });
  });
});
