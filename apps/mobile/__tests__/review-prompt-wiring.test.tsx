import { HOME_CARE_ALLOWED_TIERS, type AgendaEntry, type TriageResult, type Urgency } from "@bombaypetcompany/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { BackHandler } from "react-native";

import CareScreen from "../app/(tabs)/care";
import CheckResultScreen from "../app/check/result/[checkId]";
import EmergencyInterstitialScreen from "../app/check/emergency/[checkId]";

// T109 AC3: the call sites are real, not theoretical -- reuses the
// `check-result-snapshot.test.tsx`/`emergency-interstitial.test.tsx` mock
// idiom (`expo-router` + `../src/api/checks-api`), plus mocks for the two
// review modules the screens now call so this file can assert exactly what
// they were invoked with.
const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ checkId: "c1" }),
}));

const mockUseCheck = jest.fn();

jest.mock("../src/api/checks-api", () => ({
  useCheck: (checkId: string) => mockUseCheck(checkId),
}));

const mockMaybeRequestReview = jest.fn();

jest.mock("../src/review/request-review", () => ({
  maybeRequestReview: (...args: unknown[]) => mockMaybeRequestReview(...args),
}));

const mockRecordEmergencySeen = jest.fn();

// Finding 2 (checker): `mockRecordReminderEvent` is a small STATEFUL fake --
// not a bare `jest.fn()` -- so the care-tab wiring tests below can prove the
// real "5th completion requests a review" behaviour end-to-end through the
// screen's own call sites, without re-exercising `nextStreak`'s own unit
// tests (already covered by `review-trigger.test.ts` AC1.10). `mockStreak`
// is prefixed `mock` so babel-plugin-jest-hoist allows this hoisted
// `jest.mock(...)` factory to close over it.
let mockStreak = 0;
const mockRecordReminderEvent = jest.fn((event: "completed" | "snoozed" | "missed") => {
  mockStreak = event === "completed" ? mockStreak + 1 : 0;
  return mockStreak;
});

jest.mock("../src/review/review-state", () => ({
  recordEmergencySeen: (...args: unknown[]) => mockRecordEmergencySeen(...args),
  recordReminderEvent: (event: "completed" | "snoozed" | "missed") => mockRecordReminderEvent(event),
}));

jest.mock("../src/checks/region", () => ({
  getDeviceRegionCode: () => "US",
}));

const mockUseAgenda = jest.fn();
const mockCompleteMutateAsync = jest.fn();
const mockSnoozeMutateAsync = jest.fn();

// Finding 2: the streak/snooze/missed wiring lives entirely in `care.tsx`'s
// own handlers/effect, not in `agenda-api.ts`'s mutation logic (already
// covered by `agenda-screen.test.tsx`'s real-hook rollback tests) -- so the
// hook module itself is mocked here to isolate exactly the wiring this task
// added.
jest.mock("../src/api/agenda-api", () => ({
  useAgenda: (...args: unknown[]) => mockUseAgenda(...args),
  useCompleteOccurrence: () => ({ mutateAsync: (...args: unknown[]) => mockCompleteMutateAsync(...args) }),
  useSnoozeOccurrence: () => ({ mutateAsync: (...args: unknown[]) => mockSnoozeMutateAsync(...args) }),
}));

// `PetFilterChips` calls `usePets()` (real TanStack Query + `apiClient`),
// which is irrelevant to the streak-wiring assertions below and would
// otherwise need a `QueryClientProvider` just to render headless; stubbed
// to a no-op the same way `check-result-snapshot.test.tsx` stubs modules
// unrelated to what it's proving.
jest.mock("../src/components/pet-filter-chips", () => ({
  PetFilterChips: () => null,
}));

function fixtureFor(tier: Urgency): TriageResult {
  const allowsHomeCare = (HOME_CARE_ALLOWED_TIERS as readonly Urgency[]).includes(tier);
  return {
    urgency: tier,
    confidence: "high",
    summary: "General guidance based on the information provided.",
    possibleCauses: [{ name: "Mild upset stomach", whyItFits: "Reported symptoms are consistent with this." }],
    redFlagsToWatch: ["Repeated vomiting"],
    homeCare: allowsHomeCare ? ["Offer small amounts of water"] : [],
    doNot: ["Do not give human medications without veterinary guidance."],
    vetQuestions: ["How long have symptoms been present?"],
    followUpHours: 24,
  };
}

function checkWithResult(tier: Urgency, extra?: { redFlag?: { ruleId: string; payloadKey: string } }) {
  return {
    id: "c1",
    status: "DONE" as const,
    category: "vomiting",
    createdAt: "2024-01-01T00:00:00.000Z",
    ...extra,
    result: fixtureFor(tier),
  };
}

describe("review prompt wiring — check result screen (AC3.1-3.3)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("AC3.1: pressing Done on a REASSURE result requests a review", async () => {
    mockUseCheck.mockReturnValue({ data: checkWithResult("REASSURE"), isError: false, refetch: jest.fn() });

    await render(<CheckResultScreen />);
    await fireEvent.press(screen.getByTestId("check-result-done"));

    expect(mockMaybeRequestReview).toHaveBeenCalledTimes(1);
    expect(mockMaybeRequestReview).toHaveBeenCalledWith("reassure-acknowledged");
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/timeline");
  });

  // Checker Finding 1: `expectRecorded` closes the regression gap on the
  // tier-based (no-redFlag) emergency recording clause in
  // `result/[checkId].tsx`'s load effect (`urgency === "EMERGENCY_NOW" ||
  // urgency === "VET_24H"`). Because the emergency interstitial is only
  // reached when `check.redFlag !== undefined`, that clause is the ONLY
  // thing that records an AI-determined (tier-only) emergency -- deleting
  // it would leave EMERGENCY_NOW/VET_24H unrecorded while this table still
  // passed on the "never requests a review" half alone.
  it.each([
    { tier: "EMERGENCY_NOW", expectRecorded: true },
    { tier: "VET_24H", expectRecorded: true },
    { tier: "VET_SOON", expectRecorded: false },
    { tier: "MONITOR", expectRecorded: false },
  ] as const)(
    "AC3.2: pressing Done on a non-REASSURE result ($tier) never requests a review, and records an emergency only for EMERGENCY_NOW/VET_24H",
    async ({ tier, expectRecorded }) => {
      mockUseCheck.mockReturnValue({ data: checkWithResult(tier), isError: false, refetch: jest.fn() });

      await render(<CheckResultScreen />);

      expect(mockRecordEmergencySeen).toHaveBeenCalledTimes(expectRecorded ? 1 : 0);

      await fireEvent.press(screen.getByTestId("check-result-done"));

      expect(mockMaybeRequestReview).not.toHaveBeenCalled();
    },
  );

  it("AC3.3: a red-flag result never requests a review on Done, and records an emergency on load", async () => {
    mockUseCheck.mockReturnValue({
      data: checkWithResult("REASSURE", { redFlag: { ruleId: "rule-1", payloadKey: "vomiting.blood" } }),
      isError: false,
      refetch: jest.fn(),
    });

    await render(<CheckResultScreen />);

    expect(mockRecordEmergencySeen).toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("check-result-done"));

    expect(mockMaybeRequestReview).not.toHaveBeenCalled();
  });

  it("AC3.3: a FALLBACK result never requests a review on Done", async () => {
    mockUseCheck.mockReturnValue({
      data: { id: "c1", status: "FALLBACK", category: "vomiting", createdAt: "2024-01-01T00:00:00.000Z", result: undefined },
      isError: false,
      refetch: jest.fn(),
    });

    await render(<CheckResultScreen />);
    await fireEvent.press(screen.getByTestId("check-result-done"));

    expect(mockMaybeRequestReview).not.toHaveBeenCalled();
  });
});

describe("review prompt wiring — emergency interstitial (AC3.4)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCheck.mockReturnValue({
      data: { id: "c1", status: "DONE", category: "vomiting", createdAt: "2024-01-01T00:00:00.000Z", redFlag: { ruleId: "gdv-suspected", payloadKey: "gdv-suspected" } },
    });
  });

  it("AC3.4: records an emergency on mount, and the hardware-back block still registers", async () => {
    const addEventListenerSpy = jest.spyOn(BackHandler, "addEventListener");

    await render(<EmergencyInterstitialScreen />);

    expect(mockRecordEmergencySeen).toHaveBeenCalledTimes(1);
    expect(addEventListenerSpy).toHaveBeenCalledWith("hardwareBackPress", expect.any(Function));

    addEventListenerSpy.mockRestore();
  });
});

// Checker Finding 2: the reminder-streak trigger (the card's SECOND
// mandated positive moment) had zero wiring coverage -- only its pure
// logic (`nextStreak`/`hasMissedEntry`, `review-trigger.test.ts`) was
// proven. This closes that gap: completing a reminder increments the fake
// streak and, only at the 5th completion, `care.tsx`'s own handler calls
// `maybeRequestReview("reminder-streak")`; snoozing and an observed MISSED
// entry both reset it via `recordReminderEvent`.
describe("review prompt wiring — care tab streak trigger (Finding 2)", () => {
  // Fixed "today, local 09:00" so the row lands in the Today section
  // regardless of when the suite runs, and every call to `entry()` in a
  // given test yields the SAME `dueAt` (and therefore the same testID) --
  // unlike `new Date().toISOString()`, which drifts by a few ms between
  // calls and would desync the fixture from the testID built in the test.
  const FIXED_DUE_AT = (() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0).toISOString();
  })();

  function entry(overrides: Partial<AgendaEntry> = {}): AgendaEntry {
    return {
      reminderId: "reminder-1",
      petId: "11111111-1111-4111-8111-111111111111" as AgendaEntry["petId"],
      type: "VACCINE",
      title: "Rabies booster",
      dueAt: FIXED_DUE_AT,
      status: "SCHEDULED",
      virtual: true,
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockStreak = 0;
    mockUseAgenda.mockReturnValue({
      data: { from: "2020-01-01T00:00:00.000Z", to: "2020-02-01T00:00:00.000Z", entries: [entry()] },
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    });
    mockCompleteMutateAsync.mockResolvedValue("queued");
    mockSnoozeMutateAsync.mockResolvedValue(entry({ status: "SNOOZED" }));
  });

  it("completing a reminder records a streak event, and only the 5th completion requests a review", async () => {
    await render(<CareScreen />);

    const completeTestId = `agenda-item-complete-reminder-1-${new Date(entry().dueAt).getTime()}`;
    await waitFor(() => {
      expect(screen.getByTestId(completeTestId)).toBeTruthy();
    });

    for (let i = 1; i <= 4; i += 1) {
      await fireEvent.press(screen.getByTestId(completeTestId));
      await waitFor(() => {
        expect(mockRecordReminderEvent).toHaveBeenCalledTimes(i);
      });
      expect(mockRecordReminderEvent).toHaveBeenLastCalledWith("completed");
      expect(mockMaybeRequestReview).not.toHaveBeenCalledWith("reminder-streak");
    }

    await fireEvent.press(screen.getByTestId(completeTestId));
    await waitFor(() => {
      expect(mockMaybeRequestReview).toHaveBeenCalledWith("reminder-streak");
    });
    expect(mockMaybeRequestReview).toHaveBeenCalledTimes(1);
  });

  it("snoozing a reminder resets the streak via recordReminderEvent(\"snoozed\")", async () => {
    await render(<CareScreen />);

    const snoozeTestId = `agenda-item-snooze-reminder-1-${new Date(entry().dueAt).getTime()}`;
    await waitFor(() => {
      expect(screen.getByTestId(snoozeTestId)).toBeTruthy();
    });

    await fireEvent.press(screen.getByTestId(snoozeTestId));

    await waitFor(() => {
      expect(mockRecordReminderEvent).toHaveBeenCalledWith("snoozed");
    });
  });

  it("a MISSED entry in the loaded agenda window resets the streak via recordReminderEvent(\"missed\")", async () => {
    mockUseAgenda.mockReturnValue({
      data: {
        from: "2020-01-01T00:00:00.000Z",
        to: "2020-02-01T00:00:00.000Z",
        entries: [entry({ reminderId: "reminder-missed", status: "MISSED" })],
      },
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    });

    await render(<CareScreen />);

    await waitFor(() => {
      expect(mockRecordReminderEvent).toHaveBeenCalledWith("missed");
    });
  });
});
