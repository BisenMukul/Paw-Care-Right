import { createQueryClient } from "@bombaypetcompany/api-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import React from "react";

import PaywallScreen from "../app/paywall";
import { useAuthStore } from "../src/auth/auth-store";
import { clearTokens, saveTokens } from "../src/auth/secure-store";
import type { PaywallOffering } from "../src/billing/paywall-types";
import { resetPaywallExperimentSession } from "../src/experiments/paywall-experiment";
import { usePaywallExperimentAssignment } from "../src/experiments/use-paywall-experiment-assignment";

/**
 * T107 fix-round (checker findings F1 + F2, both HIGH) — realistic
 * regression coverage. `paywall-experiment-events.test.tsx` mocks
 * `usePaywallConfig()`/`useAuthStore` state wholesale and always
 * pre-signs-in the user, so it could not (and per the checker, did not)
 * catch either bug. This file deliberately does the opposite: it uses the
 * REAL `useAuthStore` (including its real async `restore()`/`refreshSession()`
 * flow), the REAL `usePaywallConfig`/`useAppConfig`/`fetchAppConfig` chain,
 * and a REAL `QueryClientProvider` — the ONLY things stubbed are the actual
 * network boundary (`apiClient.get`/`authClient.post`, the same idiom as
 * `apps/mobile/__tests__/checks-api.test.ts`), the MMKV-backed last-known-
 * good config cache (irrelevant persistence plumbing, not the auth/query
 * logic under test), `captureEvent` (for clean call assertions), the RC
 * offering (`useOfferings`, unrelated SDK), and `expo-router`.
 *
 * `apiClient.get("/v1/config")`'s mock answers "B" only when
 * `useAuthStore.getState().accessToken` is non-null at call time — i.e. it
 * behaves exactly like the real server (`assignPaywallVariant` answers "A"
 * for every unauthenticated request, `variant-assignment.ts`), without
 * needing to fabricate real JWTs or auth headers.
 */
const mockCaptureEvent = jest.fn();
jest.mock("../src/analytics/analytics", () => ({
  captureEvent: (...args: unknown[]) => mockCaptureEvent(...args),
}));

// Persistence plumbing only — NOT the auth/query layer the checker's fix
// targets. A `null` cache means every test starts from the same clean
// "never fetched before" state regardless of what an earlier test in this
// file wrote via the shared jest.setup.ts in-memory MMKV mock.
jest.mock("../src/config/app-config-cache", () => ({
  readCachedConfig: () => null,
  writeCachedConfig: jest.fn(),
}));

const mockApiGet = jest.fn();
const mockAuthPost = jest.fn();
jest.mock("../src/api/client", () => ({
  apiClient: { get: (...args: unknown[]) => mockApiGet(...args) },
  authClient: { post: (...args: unknown[]) => mockAuthPost(...args) },
}));

// `usePaywallConfig`/`fetchAppConfig`/`useAppConfig` stay REAL via
// `requireActual`; only the unrelated RC-offering hook is stubbed.
const mockUseOfferings = jest.fn();
jest.mock("../src/billing/paywall-queries", () => {
  const actual = jest.requireActual<typeof import("../src/billing/paywall-queries")>("../src/billing/paywall-queries");
  return { ...actual, useOfferings: () => mockUseOfferings() };
});

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ source: "onboarding" }),
}));

const FIXTURE_OFFERING: PaywallOffering = {
  packages: [{ id: "monthly", priceString: "$4.99/mo", introPriceString: "Free for 7 days", rcPackage: {} }],
};

const AUTH_TOKENS_FIXTURE = {
  accessToken: "access-token-1",
  refreshToken: "refresh-token-1",
  user: { id: "user-1", email: "user@example.com" },
  householdId: "household-1",
};

/** A schema-valid `/v1/config` body (`appConfigClientSchema`), varying only the paywall variant. */
function configBody(variant: "A" | "B") {
  return {
    paywall: { variant },
    minSupportedVersion: "0.0.0",
    hotlinePackVersion: 1,
    features: { checks: true, chat: true, paywall: true },
    criticalOtaVersion: null,
    minAppVersion: { ios: "0.0.0", android: "0.0.0" },
    recommendedAppVersion: { ios: "0.0.0", android: "0.0.0" },
  };
}

/** Answers exactly like the real server: `"B"` only for an authenticated request, `"A"` (the anonymous default) otherwise. */
function installAuthAwareConfigMock() {
  mockApiGet.mockImplementation(async (path: string) => {
    if (path === "/v1/config") {
      const token = useAuthStore.getState().accessToken;
      return configBody(token !== null ? "B" : "A");
    }
    throw new Error(`unexpected apiClient.get(${path})`);
  });
}

function installRefreshMock() {
  mockAuthPost.mockImplementation(async (path: string) => {
    if (path === "/v1/auth/refresh") {
      return AUTH_TOKENS_FIXTURE;
    }
    throw new Error(`unexpected authClient.post(${path})`);
  });
}

function AssignmentProbe() {
  usePaywallExperimentAssignment();
  return null;
}

function exposureCalls() {
  return mockCaptureEvent.mock.calls.filter((call) => call[0] === "paywall_experiment_exposed");
}

function assignmentCalls() {
  return mockCaptureEvent.mock.calls.filter((call) => call[0] === "paywall_experiment_assigned");
}

describe("paywall experiment — realistic auth-resolution semantics (T107 fix-round, checker F1+F2)", () => {
  // Fresh `QueryClient` per test, torn down in `afterEach`. Order matters:
  // `createQueryClient()` schedules internal GC timers (`gcTime`, default 5
  // minutes) per query, cancelled by `QueryCache.clear()` -- but only for
  // queries with no live observers. The rendered tree (and its query
  // observers) must be unmounted FIRST (`view.unmount()`), THEN the client
  // cleared/unmounted -- reversing this order otherwise leaves Jest's
  // process alive for the full 5-minute `gcTime` ("Jest did not exit one
  // second after the test run has completed").
  let client: ReturnType<typeof createQueryClient>;
  let view: Awaited<ReturnType<typeof render>> | null;

  beforeEach(async () => {
    jest.clearAllMocks();
    resetPaywallExperimentSession();
    mockUseOfferings.mockReturnValue({ data: FIXTURE_OFFERING, isLoading: false });
    await clearTokens();
    useAuthStore.setState({
      status: "restoring",
      user: null,
      householdId: null,
      accessToken: null,
      pushAsked: false,
    });
    client = createQueryClient();
    view = null;
  });

  afterEach(async () => {
    await view?.unmount();
    client.clear();
    client.unmount();
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  }

  it("cold start with no refresh token: resolves to signed-out and never emits assignment or exposure, despite the anonymous config answering 'A'", async () => {
    installAuthAwareConfigMock();

    view = await render(
      React.createElement(
        Wrapper,
        null,
        React.createElement(AssignmentProbe),
      ),
    );

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/v1/config");
    });

    await act(async () => {
      await useAuthStore.getState().restore();
    });

    await waitFor(() => {
      expect(useAuthStore.getState().status).toBe("signedOut");
    });

    // Give any stray microtask a chance to fire before asserting the negative.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockCaptureEvent).not.toHaveBeenCalled();
  });

  it("auth resolves to signed-in: assignment fires exactly once, with the AUTHENTICATED variant, never the anonymous cold-start fallback", async () => {
    await saveTokens({ accessToken: "stale-cached-access-token", refreshToken: "seed-refresh-token" });
    installAuthAwareConfigMock();
    installRefreshMock();

    view = await render(
      React.createElement(
        Wrapper,
        null,
        React.createElement(AssignmentProbe),
      ),
    );

    // The automatic mount-time fetch (staleTime 0) must settle BEFORE we
    // trigger sign-in, so there is no in-flight race between the anonymous
    // and authenticated requests for the same query key.
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/v1/config");
    });
    expect(mockCaptureEvent).not.toHaveBeenCalled();

    await act(async () => {
      await useAuthStore.getState().restore();
    });

    await waitFor(() => {
      expect(useAuthStore.getState().status).toBe("signedIn");
    });

    await waitFor(() => {
      expect(assignmentCalls()).toHaveLength(1);
    });

    expect(assignmentCalls()[0]?.[1]).toEqual({ experiment: "paywall_copy_ab", variant: "B" });
    // Non-vacuity: the anonymous fallback ("A") must never have been reported.
    expect(mockCaptureEvent).not.toHaveBeenCalledWith("paywall_experiment_assigned", {
      experiment: "paywall_copy_ab",
      variant: "A",
    });
  });

  it("paywall exposure: does not double-expose across the anonymous-then-authenticated flip (never reports 'A' then 'B' for the same view)", async () => {
    await saveTokens({ accessToken: "stale-cached-access-token", refreshToken: "seed-refresh-token" });
    installAuthAwareConfigMock();
    installRefreshMock();

    view = await render(React.createElement(Wrapper, null, React.createElement(PaywallScreen)));

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/v1/config");
    });
    // `paywall_view` (T078, unaffected by this fix) may already have fired;
    // the experiment's exposure event must NOT have, since auth has not
    // resolved yet and the only config seen so far is the anonymous "A".
    expect(exposureCalls()).toHaveLength(0);

    await act(async () => {
      await useAuthStore.getState().restore();
    });

    await waitFor(() => {
      expect(exposureCalls()).toHaveLength(1);
    });

    expect(exposureCalls()[0]?.[1]).toEqual({ experiment: "paywall_copy_ab", variant: "B" });
  });
});
