import { APP_DISPLAY_NAME } from "@pawcareright/config";
import { HOME_CARE_ALLOWED_TIERS, SAFE_FALLBACK, URGENCY_TIERS, type TriageResult, type Urgency } from "@pawcareright/types";
import { render, screen } from "@testing-library/react-native";

import CheckResultScreen from "../app/check/result/[checkId]";
import { strings } from "../src/strings";

// T048 plan AC1 "Snapshot per tier" + "disclaimer presence asserted in every
// snapshot": one stable snapshot per URGENCY_TIERS entry, plus AC2's
// FALLBACK (distinct snapshot) and defensive-guard cases (D3, D5).
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ checkId: "c1" }),
}));

const mockUseCheck = jest.fn();

jest.mock("../src/api/checks-api", () => ({
  useCheck: (checkId: string) => mockUseCheck(checkId),
}));

/** A minimal, schema-valid `TriageResult` for the given tier (mirrors
 * packages/types/src/triage.spec.ts's fixture builder), respecting
 * HOME_CARE_ALLOWED_TIERS: homeCare is empty for EMERGENCY_NOW/VET_24H. */
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

describe("check result screen snapshots", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(URGENCY_TIERS)("renders a stable snapshot for %s with the disclaimer present", async (tier) => {
    mockUseCheck.mockReturnValue({
      data: { id: "c1", status: "DONE", category: "vomiting", createdAt: "2024-01-01T00:00:00.000Z", result: fixtureFor(tier) },
      isError: false,
      refetch: jest.fn(),
    });

    const { toJSON } = await render(<CheckResultScreen />);

    expect(toJSON()).toMatchSnapshot();
    expect(screen.getByTestId("vet-disclaimer")).toBeTruthy();
  });

  it("renders a distinct FALLBACK snapshot with the fallback notice and disclaimer", async () => {
    mockUseCheck.mockReturnValue({
      data: { id: "c1", status: "FALLBACK", category: "vomiting", createdAt: "2024-01-01T00:00:00.000Z", result: SAFE_FALLBACK },
      isError: false,
      refetch: jest.fn(),
    });

    const { toJSON } = await render(<CheckResultScreen />);

    expect(toJSON()).toMatchSnapshot();
    expect(screen.getByTestId("check-result-fallback-notice")).toBeTruthy();
    expect(screen.getByTestId("vet-disclaimer")).toBeTruthy();
  });

  it("renders a distinct snapshot with the emergency notice above all AI content when redFlag is present", async () => {
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

    const { toJSON } = await render(<CheckResultScreen />);

    expect(toJSON()).toMatchSnapshot();
    expect(screen.getByTestId("check-result-emergency-notice")).toBeTruthy();
    expect(screen.getByTestId("vet-disclaimer")).toBeTruthy();
  });

  it("defensive guard: a terminal DONE check missing a result renders the fallback notice without throwing", async () => {
    mockUseCheck.mockReturnValue({
      data: { id: "c1", status: "DONE", category: "vomiting", createdAt: "2024-01-01T00:00:00.000Z", result: undefined },
      isError: false,
      refetch: jest.fn(),
    });

    await render(<CheckResultScreen />);

    expect(screen.getByTestId("check-result-fallback-notice")).toBeTruthy();
    expect(screen.getByTestId("vet-disclaimer")).toBeTruthy();
  });

  // PAWSAATHI-3 plan (decision 2 / Risk R2): `vet-disclaimer.tsx` is
  // ZERO-DIFF this batch -- its `brand-900`-on-`brand-50` pair is already
  // AAA on any OS scheme (its own opaque light container never sits on a
  // dark surface), so it gets no `dark:`/`font-*` token. Pins that both the
  // node's className and its rendered text stay byte-identical.
  it("PAWSAATHI-3: vet-disclaimer carries no dark: token and its text is byte-identical", async () => {
    mockUseCheck.mockReturnValue({
      data: { id: "c1", status: "DONE", category: "vomiting", createdAt: "2024-01-01T00:00:00.000Z", result: fixtureFor("MONITOR") },
      isError: false,
      refetch: jest.fn(),
    });

    await render(<CheckResultScreen />);

    const disclaimer = screen.getByTestId("vet-disclaimer");
    expect(disclaimer.props.className).not.toContain("dark:");

    const disclaimerText = screen.getByText(strings.check.result.disclaimer(APP_DISPLAY_NAME));
    expect(disclaimerText.props.className).not.toContain("dark:");
    expect(disclaimerText.props.children).toBe(strings.check.result.disclaimer(APP_DISPLAY_NAME));
  });

  // FIDELITY-2 plan R6/R7: the cream page-root migration must not reach
  // `vet-disclaimer.tsx` -- it is SAFETY-FROZEN and keeps `bg-brand-50`
  // byte-identical (denylisted from the page-vs-tint sweep). Pins the
  // subtree byte-identity the re-recorded snapshots rely on.
  it("FIDELITY-2: vet-disclaimer subtree stays bg-brand-50 (zero-diff, denylisted from the cream page sweep)", async () => {
    mockUseCheck.mockReturnValue({
      data: { id: "c1", status: "DONE", category: "vomiting", createdAt: "2024-01-01T00:00:00.000Z", result: fixtureFor("MONITOR") },
      isError: false,
      refetch: jest.fn(),
    });

    await render(<CheckResultScreen />);

    const disclaimer = screen.getByTestId("vet-disclaimer");
    expect(disclaimer.props.className).toContain("bg-brand-50");
    expect(disclaimer.props.className).not.toContain("bg-surface-page");
  });
});
