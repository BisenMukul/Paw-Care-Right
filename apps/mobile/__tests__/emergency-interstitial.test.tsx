import { EMERGENCY_PAYLOADS } from "@pawcareright/data";
import type { CheckResponse, TriageResult } from "@pawcareright/types";
import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Linking from "expo-linking";
import { BackHandler } from "react-native";

import EmergencyInterstitialScreen from "../app/check/emergency/[checkId]";

// T049 plan "Acceptance-criteria -> test mapping" / "Test idioms".
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

const mockGetDeviceRegionCode = jest.fn();

jest.mock("../src/checks/region", () => ({
  getDeviceRegionCode: () => mockGetDeviceRegionCode(),
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

function checkWith(payloadKey: string | undefined, withResult: boolean): CheckResponse {
  return {
    id: "c1",
    status: "DONE",
    category: "vomiting",
    createdAt: "2024-01-01T00:00:00.000Z",
    ...(payloadKey !== undefined ? { redFlag: { ruleId: "gdv-suspected", payloadKey } } : {}),
    ...(withResult ? { result: aiResult() } : {}),
  };
}

describe("emergency interstitial — hotline resolution + fallback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("region US shows the ASPCA hotline and pressing the call button dials it", async () => {
    mockUseCheck.mockReturnValue({ data: checkWith("gdv-suspected", false) });
    mockGetDeviceRegionCode.mockReturnValue("US");

    await render(<EmergencyInterstitialScreen />);

    expect(screen.getByTestId("emergency-hotline-name").props.children).toContain("ASPCA");
    expect(screen.getByTestId("emergency-hotline-number").props.children).toBe("(888) 426-4435");

    await fireEvent.press(screen.getByTestId("emergency-call-hotline"));
    expect(Linking.openURL).toHaveBeenCalledWith("tel:+18884264435");
  });

  it("region undefined shows the fallback copy with no number and no call button", async () => {
    mockUseCheck.mockReturnValue({ data: checkWith("gdv-suspected", false) });
    mockGetDeviceRegionCode.mockReturnValue(undefined);

    await render(<EmergencyInterstitialScreen />);

    expect(screen.getByTestId("emergency-hotline-fallback")).toBeTruthy();
    expect(screen.queryByTestId("emergency-call-hotline")).toBeNull();
    expect(screen.getByTestId("emergency-find-vet")).toBeTruthy();
  });

  it("unknown region (ZZ) shows the fallback copy with no number and no call button", async () => {
    mockUseCheck.mockReturnValue({ data: checkWith("gdv-suspected", false) });
    mockGetDeviceRegionCode.mockReturnValue("ZZ");

    await render(<EmergencyInterstitialScreen />);

    expect(screen.getByTestId("emergency-hotline-fallback")).toBeTruthy();
    expect(screen.queryByTestId("emergency-call-hotline")).toBeNull();
  });
});

describe("emergency interstitial — renders before any AI content (flow test)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDeviceRegionCode.mockReturnValue("US");
  });

  it("renders the payload for the check's redFlag.payloadKey and never any AI result content", async () => {
    mockUseCheck.mockReturnValue({ data: checkWith("gdv-suspected", true) });

    await render(<EmergencyInterstitialScreen />);

    expect(screen.getByTestId("emergency-title").props.children).toBe("Possible bloat — get to a vet now");
    expect(screen.queryByText("AI-SUMMARY-SENTINEL")).toBeNull();
    expect(screen.queryByTestId("check-result-summary")).toBeNull();
    expect(screen.queryByTestId("check-result-possible-causes")).toBeNull();
    expect(screen.queryByTestId("check-result-urgency-banner")).toBeNull();
  });

  it("does not navigate on mount, and acknowledge replaces to the result route", async () => {
    mockUseCheck.mockReturnValue({ data: checkWith("gdv-suspected", true) });

    await render(<EmergencyInterstitialScreen />);

    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("emergency-acknowledge"));

    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/check/result/[checkId]", params: { checkId: "c1" } });
  });
});

describe("emergency interstitial — acknowledge-gating (cannot be dismissed accidentally)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDeviceRegionCode.mockReturnValue("US");
  });

  it("blocks the Android hardware back button (registered handler returns true)", async () => {
    mockUseCheck.mockReturnValue({ data: checkWith("gdv-suspected", false) });
    const addEventListenerSpy = jest.spyOn(BackHandler, "addEventListener");

    await render(<EmergencyInterstitialScreen />);

    expect(addEventListenerSpy).toHaveBeenCalledWith("hardwareBackPress", expect.any(Function));
    const [, handler] = addEventListenerSpy.mock.calls[0] as [string, () => boolean];
    expect(handler()).toBe(true);

    addEventListenerSpy.mockRestore();
  });
});

describe("emergency interstitial — fail-upward when payloadKey is missing/unknown", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDeviceRegionCode.mockReturnValue("US");
  });

  it("renders the generic emergency payload when redFlag is missing", async () => {
    mockUseCheck.mockReturnValue({ data: checkWith(undefined, false) });

    await render(<EmergencyInterstitialScreen />);

    expect(screen.getByTestId("emergency-title").props.children).toBe("This may be an emergency");
  });

  it("renders the generic emergency payload when the check hasn't loaded yet", async () => {
    mockUseCheck.mockReturnValue({ data: undefined });

    await render(<EmergencyInterstitialScreen />);

    expect(screen.getByTestId("emergency-title").props.children).toBe("This may be an emergency");
  });

  it("renders the generic emergency payload for an unknown payloadKey", async () => {
    mockUseCheck.mockReturnValue({ data: checkWith("no-such-key", false) });

    await render(<EmergencyInterstitialScreen />);

    expect(screen.getByTestId("emergency-title").props.children).toBe("This may be an emergency");
  });
});

describe("emergency interstitial — every payloadKey renders (data-driven)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDeviceRegionCode.mockReturnValue("US");
  });

  it.each(EMERGENCY_PAYLOADS)("renders $key's title and guidance", async (expected) => {
    mockUseCheck.mockReturnValue({ data: checkWith(expected.key, false) });

    await render(<EmergencyInterstitialScreen />);

    expect(screen.getByTestId("emergency-title").props.children).toBe(expected.title);
    expect(screen.getByTestId("emergency-guidance").props.children).toBe(expected.guidance);
  });
});

describe("emergency interstitial — find-vet action", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDeviceRegionCode.mockReturnValue("US");
  });

  it("find-vet opens the emergency maps URL", async () => {
    mockUseCheck.mockReturnValue({ data: checkWith("gdv-suspected", false) });

    await render(<EmergencyInterstitialScreen />);
    await fireEvent.press(screen.getByTestId("emergency-find-vet"));

    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining("emergency"));
  });
});
