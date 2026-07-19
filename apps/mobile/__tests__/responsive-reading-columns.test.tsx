import { HOME_CARE_ALLOWED_TIERS, type TriageResult, type Urgency } from "@pawcareright/types";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import * as ReactNative from "react-native";

import CheckResultScreen from "../app/check/result/[checkId]";
import PaywallScreen from "../app/paywall";
import type { PaywallOffering } from "../src/billing/paywall-types";

/**
 * RESPONSIVE-1 plan §7.3 reading-column cap: check-result + paywall content
 * (and the paywall CTA footer) get a centered `max-w-2xl` column on `wide`
 * (>=768dp) only. Emergency-notice-first ordering, `<VetDisclaimer/>`,
 * `check-result-*`/`paywall-*` testIDs all survive unchanged in both
 * buckets.
 */
function spyWidth(width: number) {
  return jest.spyOn(ReactNative, "useWindowDimensions").mockReturnValue({
    width,
    height: 1200,
    scale: 2,
    fontScale: 1,
  });
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ checkId: "c1" }),
}));

const mockUseCheck = jest.fn();

jest.mock("../src/api/checks-api", () => ({
  useCheck: (checkId: string) => mockUseCheck(checkId),
}));

function fixtureFor(tier: Urgency): TriageResult {
  const allowsHomeCare = (HOME_CARE_ALLOWED_TIERS as readonly Urgency[]).includes(tier);
  return {
    urgency: tier,
    confidence: "high",
    summary: "General guidance based on the information provided.",
    possibleCauses: [{ name: "Mild upset stomach", whyItFits: "Reported symptoms are consistent with this." }],
    redFlagsToWatch: ["Repeated vomiting", "Lethargy that worsens"],
    homeCare: allowsHomeCare ? ["Offer small amounts of water"] : [],
    doNot: ["Do not give human medications without veterinary guidance."],
    vetQuestions: ["How long have symptoms been present?"],
    followUpHours: 24,
  };
}

describe("check-result: wide vs regular reading column", () => {
  beforeEach(() => {
    mockUseCheck.mockReturnValue({
      data: {
        id: "c1",
        status: "DONE",
        category: "vomiting",
        createdAt: "2024-01-01T00:00:00.000Z",
        redFlag: { ruleId: "rule-1", payloadKey: "vomiting.blood" },
        result: fixtureFor("EMERGENCY_NOW"),
      },
      isError: false,
      refetch: jest.fn(),
    });
  });

  it("wide (900): content wrapper carries max-w-2xl self-center; emergency-notice-first + disclaimer + testIDs preserved", async () => {
    spyWidth(900);

    await render(<CheckResultScreen />);

    const contentWrapper = screen.getByTestId("check-result-urgency-banner").parent;
    expect(contentWrapper?.props.className).toContain("max-w-2xl");
    expect(contentWrapper?.props.className).toContain("self-center");
    expect(contentWrapper?.props.className).toContain("gap-6 px-4 pb-8 pt-4");

    expect(screen.getByTestId("check-result-emergency-notice")).toBeTruthy();
    expect(screen.getByTestId("vet-disclaimer")).toBeTruthy();
  });

  it("regular (390): content wrapper className is byte-identical to the base string", async () => {
    spyWidth(390);

    await render(<CheckResultScreen />);

    const contentWrapper = screen.getByTestId("check-result-urgency-banner").parent;
    expect(contentWrapper?.props.className).toBe("gap-6 px-4 pb-8 pt-4");

    expect(screen.getByTestId("check-result-emergency-notice")).toBeTruthy();
    expect(screen.getByTestId("vet-disclaimer")).toBeTruthy();
  });
});

const FIXTURE_OFFERING: PaywallOffering = {
  packages: [
    { id: "monthly", priceString: "$4.99/mo", introPriceString: "Free for 7 days", rcPackage: {} },
    { id: "annual", priceString: "$39.99/yr", rcPackage: {} },
    { id: "family", priceString: "$59.99/yr", rcPackage: {} },
  ],
};

const mockUsePaywallConfig = jest.fn();
const mockUseOfferings = jest.fn();

jest.mock("../src/billing/paywall-queries", () => ({
  usePaywallConfig: () => mockUsePaywallConfig(),
  useOfferings: () => mockUseOfferings(),
}));

describe("paywall: wide vs regular reading column", () => {
  beforeEach(() => {
    mockUsePaywallConfig.mockReturnValue({ data: { variant: "A" } });
    mockUseOfferings.mockReturnValue({ data: FIXTURE_OFFERING, isLoading: false });
  });

  it("wide (900): content + CTA footer carry max-w-2xl self-center; all paywall-* testIDs preserved", async () => {
    spyWidth(900);

    await render(<PaywallScreen />);

    const contentWrapper = screen.getByTestId("paywall-headline").parent;
    expect(contentWrapper?.props.className).toContain("max-w-2xl");
    expect(contentWrapper?.props.className).toContain("self-center");

    const ctaButton = screen.getByTestId("paywall-trial-cta");
    const ctaFooter = ctaButton.parent;
    expect(ctaFooter?.props.className).toContain("max-w-2xl");
    expect(ctaFooter?.props.className).toContain("self-center");
    expect(ctaFooter?.props.className).toContain("border-t");

    expect(screen.getByTestId("paywall-plan-annual")).toBeTruthy();
    expect(screen.getByTestId("paywall-restore")).toBeTruthy();
    expect(screen.getByTestId("paywall-terms")).toBeTruthy();
  });

  it("regular (390): content + CTA footer className stay byte-identical to today", async () => {
    spyWidth(390);

    await render(<PaywallScreen />);

    const contentWrapper = screen.getByTestId("paywall-headline").parent;
    expect(contentWrapper?.props.className).toBe("gap-6 px-4 pb-8 pt-4");

    const ctaButton = screen.getByTestId("paywall-trial-cta");
    const ctaFooter = ctaButton.parent;
    expect(ctaFooter?.props.className).toBe(
      "border-t border-brand-100 dark:border-hairline-dark bg-brand-50 dark:bg-surface-page-dark px-4 pb-6 pt-3",
    );
  });
});
