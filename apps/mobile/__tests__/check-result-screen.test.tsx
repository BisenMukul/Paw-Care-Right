import { APP_DISPLAY_NAME } from "@pawcareright/config";
import { HOME_CARE_ALLOWED_TIERS, type TriageResult, type Urgency } from "@pawcareright/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Linking from "expo-linking";
import { Share } from "react-native";

import CheckResultScreen from "../app/check/result/[checkId]";
import { EMERGENCY_VET_QUERY, ROUTINE_VET_QUERY, VET_SEARCH_MAPS_BASE } from "../src/checks/vet-search";
import { strings } from "../src/strings";

// T048 plan "Behavior / DoD (check-result-screen.test.tsx)".
const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useLocalSearchParams: () => ({ checkId: "c1" }),
}));

const mockUseCheck = jest.fn();

jest.mock("../src/api/checks-api", () => ({
  useCheck: (checkId: string) => mockUseCheck(checkId),
}));

jest.mock("expo-linking", () => ({
  openURL: jest.fn(),
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

describe("check result screen behavior", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("done press replaces to the timeline tab", async () => {
    mockUseCheck.mockReturnValue({ data: checkWithResult("MONITOR"), isError: false, refetch: jest.fn() });

    await render(<CheckResultScreen />);
    await fireEvent.press(screen.getByTestId("check-result-done"));

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/timeline");
  });

  it("renders the emergency notice above all AI content and its CTA pushes to the emergency route", async () => {
    mockUseCheck.mockReturnValue({
      data: checkWithResult("EMERGENCY_NOW", { redFlag: { ruleId: "rule-1", payloadKey: "vomiting.blood" } }),
      isError: false,
      refetch: jest.fn(),
    });

    await render(<CheckResultScreen />);

    expect(screen.getByTestId("check-result-emergency-notice")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("check-result-emergency-cta"));

    expect(mockPush).toHaveBeenCalledWith({ pathname: "/check/emergency/[checkId]", params: { checkId: "c1" } });
  });

  it("shows the error state and retry calls refetch", async () => {
    const refetch = jest.fn();
    mockUseCheck.mockReturnValue({ data: undefined, isError: true, refetch });

    await render(<CheckResultScreen />);

    expect(screen.getByTestId("check-result-error")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("check-result-retry"));

    expect(refetch).toHaveBeenCalled();
  });

  it("shows the loading state when the check is non-terminal", async () => {
    mockUseCheck.mockReturnValue({
      data: { id: "c1", status: "RUNNING", category: "vomiting", createdAt: "2024-01-01T00:00:00.000Z" },
      isError: false,
      refetch: jest.fn(),
    });

    await render(<CheckResultScreen />);

    expect(screen.getByTestId("check-result-loading")).toBeTruthy();
  });

  it("shows the loading state when there is no data yet", async () => {
    mockUseCheck.mockReturnValue({ data: undefined, isError: false, refetch: jest.fn() });

    await render(<CheckResultScreen />);

    expect(screen.getByTestId("check-result-loading")).toBeTruthy();
  });

  it("find-vet opens the emergency maps URL for an EMERGENCY_NOW result", async () => {
    mockUseCheck.mockReturnValue({ data: checkWithResult("EMERGENCY_NOW"), isError: false, refetch: jest.fn() });

    await render(<CheckResultScreen />);
    await fireEvent.press(screen.getByTestId("check-result-find-vet"));

    expect(Linking.openURL).toHaveBeenCalledWith(`${VET_SEARCH_MAPS_BASE}${encodeURIComponent(EMERGENCY_VET_QUERY)}`);
  });

  it("find-vet opens the routine maps URL for a MONITOR result", async () => {
    mockUseCheck.mockReturnValue({ data: checkWithResult("MONITOR"), isError: false, refetch: jest.fn() });

    await render(<CheckResultScreen />);
    await fireEvent.press(screen.getByTestId("check-result-find-vet"));

    expect(Linking.openURL).toHaveBeenCalledWith(`${VET_SEARCH_MAPS_BASE}${encodeURIComponent(ROUTINE_VET_QUERY)}`);
  });

  it("share calls Share.share with a message containing the disclaimer line", async () => {
    const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
    mockUseCheck.mockReturnValue({ data: checkWithResult("VET_SOON"), isError: false, refetch: jest.fn() });

    await render(<CheckResultScreen />);
    await fireEvent.press(screen.getByTestId("check-result-share"));

    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    const [payload] = shareSpy.mock.calls[0] as [{ message: string }];
    expect(payload.message).toContain(strings.check.result.disclaimer(APP_DISPLAY_NAME));

    shareSpy.mockRestore();
  });
});
