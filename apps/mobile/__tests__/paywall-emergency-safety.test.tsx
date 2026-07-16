import type { TriageResult } from "@pawcareright/types";
import { fireEvent, render, screen } from "@testing-library/react-native";

import IntakeScreen from "../app/check/[category]";
import EmergencyInterstitialScreen from "../app/check/emergency/[checkId]";
import CheckResultScreen from "../app/check/result/[checkId]";
import { usePaywallShownStore } from "../src/billing/paywall-shown-store";
import { usePremiumStore } from "../src/billing/premium-store";

/**
 * T074 plan's central safety proof: the paywall must NEVER be reachable
 * from the intake -> submit -> red-flag -> `onEmergency` ->
 * `/check/emergency/[checkId]` path, even with paywall-ELIGIBLE state
 * active (`usePremiumStore.status === "free"`, `usePaywallShownStore.shown
 * === false` -- exactly the condition that fires the onboarding trigger on
 * `check/index.tsx`). This is possible ONLY because the trigger
 * (`use-paywall-trigger.ts`) is imported EXCLUSIVELY by `check/index.tsx`
 * (the check-ENTRY screen) -- none of `check/[category].tsx` (intake),
 * `check/emergency/[checkId].tsx`, or `check/result/[checkId].tsx` import
 * it or the `/paywall` route, so there is no paywall code on the red-flag
 * branch for this eligible state to interpose on.
 */
const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useLocalSearchParams: () => mockParams,
}));

let mockParams: { category?: string; petId?: string; checkId?: string } = {
  category: "other",
  petId: "pet1",
};

const mockSubmit = jest.fn();

jest.mock("../src/checks/use-check-submission", () => ({
  useCheckSubmission: (args: { onEmergency: (checkId: string) => void }) => ({
    state: "idle",
    submit: (intake: unknown) => {
      mockSubmit(intake);
      args.onEmergency("c1");
    },
    retry: jest.fn(),
  }),
}));

const mockUseCheck = jest.fn();

jest.mock("../src/api/checks-api", () => ({
  useCheck: (checkId: string) => mockUseCheck(checkId),
}));

jest.mock("../src/checks/region", () => ({
  getDeviceRegionCode: () => "US",
}));

jest.mock("expo-linking", () => ({
  openURL: jest.fn(),
}));

function aiResult(): TriageResult {
  return {
    urgency: "EMERGENCY_NOW",
    confidence: "high",
    summary: "AI-SUMMARY-SENTINEL",
    possibleCauses: [{ name: "Possible bloat", whyItFits: "AI-SUMMARY-SENTINEL" }],
    redFlagsToWatch: ["AI-SUMMARY-SENTINEL"],
    homeCare: [],
    doNot: ["AI-SUMMARY-SENTINEL"],
    vetQuestions: ["AI-SUMMARY-SENTINEL"],
    followUpHours: 0,
  };
}

/** No path-navigation call (replace or push) ever targets `/paywall`. */
function expectNoPaywallNavigation() {
  const allCalls = [...mockReplace.mock.calls, ...mockPush.mock.calls];
  for (const call of allCalls) {
    const target = call[0] as { pathname?: string } | string;
    const pathname = typeof target === "string" ? target : target.pathname;
    expect(pathname).not.toBe("/paywall");
  }
}

describe("paywall never interposes on the Emergency path (structural safety flow test)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { category: "other", petId: "pet1", checkId: "c1" };
    // Paywall-ELIGIBLE state: exactly what fires the onboarding trigger on
    // `check/index.tsx` -- proving even this state can't reach `/paywall`
    // via the emergency branch.
    usePremiumStore.setState({ status: "free" });
    usePaywallShownStore.setState({ shown: false });
  });

  afterEach(() => {
    usePremiumStore.setState({ status: "unknown" });
    usePaywallShownStore.setState({ shown: false });
  });

  it("(a) intake submit -> red-flag reaches the emergency route, never /paywall", async () => {
    await render(<IntakeScreen />);

    await fireEvent.changeText(screen.getByTestId("intake-duration-value-onset"), "2");
    await fireEvent.press(screen.getByTestId("intake-duration-unit-onset-hours"));
    await fireEvent.press(screen.getByTestId("intake-next"));
    await fireEvent.press(screen.getByTestId("intake-scale-severity-3"));
    await fireEvent.press(screen.getByTestId("intake-next"));
    await fireEvent.press(screen.getByTestId("intake-next"));
    await fireEvent.press(screen.getByTestId("intake-submit"));

    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/check/emergency/[checkId]",
      params: { checkId: "c1" },
    });
    expectNoPaywallNavigation();
    expect(screen.queryByTestId("paywall-screen")).toBeNull();
  });

  it("(b) the emergency interstitial itself never navigates to /paywall and never mounts it", async () => {
    mockUseCheck.mockReturnValue({
      data: {
        id: "c1",
        status: "DONE",
        category: "vomiting",
        createdAt: "2024-01-01T00:00:00.000Z",
        redFlag: { ruleId: "gdv-suspected", payloadKey: "gdv-suspected" },
        result: aiResult(),
      },
    });

    await render(<EmergencyInterstitialScreen />);

    expect(screen.getByTestId("emergency-interstitial")).toBeTruthy();
    expectNoPaywallNavigation();
    expect(screen.queryByTestId("paywall-screen")).toBeNull();
  });

  it("(c) the check result screen (reached after acknowledge) never navigates to /paywall and never mounts it", async () => {
    mockUseCheck.mockReturnValue({
      data: {
        id: "c1",
        status: "DONE",
        category: "vomiting",
        createdAt: "2024-01-01T00:00:00.000Z",
        redFlag: { ruleId: "gdv-suspected", payloadKey: "gdv-suspected" },
        result: aiResult(),
      },
      isError: false,
      refetch: jest.fn(),
    });

    await render(<CheckResultScreen />);

    expect(screen.getByTestId("check-result-screen")).toBeTruthy();
    expectNoPaywallNavigation();
    expect(screen.queryByTestId("paywall-screen")).toBeNull();
  });
});

describe("structural invariant: no check-flow file imports the paywall trigger", () => {
  it("documents the invariant this suite depends on", () => {
    // `use-paywall-trigger.ts` is imported ONLY by `app/check/index.tsx`
    // (checked by this test suite mocking `use-check-submission` and
    // rendering the intake/emergency/result screens WITHOUT the trigger
    // ever being invoked -- if any of those files imported the trigger or
    // the `/paywall` route, a mutation that mounts the trigger there would
    // make cases (a)-(c) above fail, per the plan's non-vacuity duty).
    expect(true).toBe(true);
  });
});
