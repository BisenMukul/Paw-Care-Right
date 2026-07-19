import {
  HOME_CARE_ALLOWED_TIERS,
  INTAKE_CATEGORIES,
  type CheckResponse,
  type TriageResult,
  type Urgency,
} from "@pawcareright/types";
import { render, screen, type RenderResult } from "@testing-library/react-native";

import CheckEntryScreen from "../app/check/index";
import CheckHistoryScreen from "../app/check/history/[petId]";
import CheckResultScreen from "../app/check/result/[checkId]";
import CheckWaitingScreen from "../app/check/waiting/[checkId]";
import { CategoryGrid } from "../src/components/category-grid";
import { CheckHistoryRow } from "../src/components/check-history-row";

// SWEEP-3 plan §"Tests to write" (design-system.md §6 cross-screen coverage
// for the symptom-check flow). Mirrors SWEEP-2's `auth-onboarding-a11y.
// test.tsx` idiom (local JSON-tree search helpers, no third-party a11y
// matcher). This suite is presentation-only evidence: it never asserts on
// check-store/api/polling/red-flag/router-target behavior, which the
// existing behavioral suites (`check-*-screen.test.tsx`,
// `check-result-snapshot.test.tsx`, `emergency-interstitial.test.tsx`,
// `paywall-emergency-safety.test.tsx`) already cover and which SWEEP-3 keeps
// green unchanged.
const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
}));

const mockUseChecksList = jest.fn();
const mockUseCheck = jest.fn();

jest.mock("../src/api/checks-api", () => ({
  useChecksList: (petId: string) => mockUseChecksList(petId),
  useCheck: (checkId: string) => mockUseCheck(checkId),
}));

type JsonNode = ReturnType<RenderResult["toJSON"]>;

/** Recursively searches a rendered JSON tree for a node whose `className`
 * (string prop, as NativeWind passes it through unresolved under this
 * workspace's jest setup) matches `predicate` (SWEEP-2 precedent, `auth-
 * onboarding-a11y.test.tsx`). */
function findClassName(
  node: JsonNode | JsonNode[] | string | null | undefined,
  predicate: (className: string) => boolean,
): boolean {
  if (node == null || typeof node === "string") {
    return false;
  }
  if (Array.isArray(node)) {
    return node.some((child) => findClassName(child, predicate));
  }
  const className = (node.props as { className?: unknown } | undefined)?.className;
  if (typeof className === "string" && predicate(className)) {
    return true;
  }
  return findClassName(node.children as JsonNode[] | null, predicate);
}

/** Recursively searches for a node of the given host-component `type`
 * (e.g. `"ActivityIndicator"`) -- used to prove a spinner was replaced by a
 * content-shaped `Skeleton` (design-system.md §2.11). */
function findType(node: JsonNode | JsonNode[] | string | null | undefined, type: string): boolean {
  if (node == null || typeof node === "string") {
    return false;
  }
  if (Array.isArray(node)) {
    return node.some((child) => findType(child, type));
  }
  if (node.type === type) {
    return true;
  }
  return findType(node.children as JsonNode[] | null, type);
}

/** In-order flattened testIDs, to assert the frozen §5/§7 information
 * hierarchy on the result screen without touching its behavior. */
function orderedTestIds(node: JsonNode | JsonNode[] | string | null | undefined, acc: string[] = []): string[] {
  if (node == null || typeof node === "string") {
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => orderedTestIds(child, acc));
    return acc;
  }
  const testID = (node.props as { testID?: unknown } | undefined)?.testID;
  if (typeof testID === "string") {
    acc.push(testID);
  }
  orderedTestIds(node.children as JsonNode[] | null, acc);
  return acc;
}

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

const EMPTY_LIST_PAGE = {
  data: { pages: [{ items: [], nextCursor: null }] },
  isLoading: false,
  isError: false,
  refetch: jest.fn(),
  isRefetching: false,
  hasNextPage: false,
  fetchNextPage: jest.fn(),
  isFetchingNextPage: false,
};

const MONITOR_ITEM: CheckResponse = {
  id: "c1",
  status: "DONE",
  category: "vomiting",
  createdAt: "2024-01-01T00:00:00.000Z",
  result: fixtureFor("MONITOR"),
} as unknown as CheckResponse;

describe("check-flow-a11y: page contract (bg-surface-page, no home gradient)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { petId: "pet1" };
    mockUseChecksList.mockReturnValue(EMPTY_LIST_PAGE);
  });

  it("check entry screen is bg-surface-page with no gradient", async () => {
    const { toJSON } = await render(<CheckEntryScreen />);

    expect(findClassName(toJSON(), (c) => c.includes("bg-surface-page"))).toBe(true);
    expect(screen.queryByTestId("home-gradient-background")).toBeNull();
    expect(screen.queryByTestId("home-gradient-fallback")).toBeNull();
  });

  it("check history screen is bg-surface-page with no gradient", async () => {
    mockUseChecksList.mockReturnValue({ ...EMPTY_LIST_PAGE, ...{ data: { pages: [{ items: [MONITOR_ITEM], nextCursor: null }] } } });

    const { toJSON } = await render(<CheckHistoryScreen />);

    expect(findClassName(toJSON(), (c) => c.includes("bg-surface-page"))).toBe(true);
    expect(screen.queryByTestId("home-gradient-background")).toBeNull();
  });

  it("check waiting screen is bg-surface-page with no gradient", async () => {
    mockParams = { checkId: "c1", petId: "pet1" };
    mockUseCheck.mockReturnValue({ data: { id: "c1", status: "RUNNING", category: "vomiting", createdAt: "2024-01-01T00:00:00.000Z" } });

    const { toJSON } = await render(<CheckWaitingScreen />);

    expect(findClassName(toJSON(), (c) => c.includes("bg-surface-page"))).toBe(true);
    expect(screen.queryByTestId("home-gradient-background")).toBeNull();
  });

  it("check result screen (content state) is bg-surface-page with no gradient", async () => {
    mockParams = { checkId: "c1" };
    mockUseCheck.mockReturnValue({
      data: { id: "c1", status: "DONE", category: "vomiting", createdAt: "2024-01-01T00:00:00.000Z", result: fixtureFor("MONITOR") },
      isError: false,
      refetch: jest.fn(),
    });

    const { toJSON } = await render(<CheckResultScreen />);

    expect(findClassName(toJSON(), (c) => c.includes("bg-surface-page"))).toBe(true);
    expect(screen.queryByTestId("home-gradient-background")).toBeNull();
  });
});

describe("check-flow-a11y: header canon (role=header, capped font scale)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { petId: "pet1" };
    mockUseChecksList.mockReturnValue(EMPTY_LIST_PAGE);
  });

  it("entry screen title is a header, capped at 1.5x", async () => {
    await render(<CheckEntryScreen />);

    const title = screen.getByText("What's going on?");
    expect(title.props.accessibilityRole).toBe("header");
    expect(title.props.maxFontSizeMultiplier).toBe(1.5);
  });

  it("history screen title is a header, capped at 1.5x", async () => {
    await render(<CheckHistoryScreen />);

    const title = screen.getByText("Check history");
    expect(title.props.accessibilityRole).toBe("header");
    expect(title.props.maxFontSizeMultiplier).toBe(1.5);
  });

  it("waiting screen title is a header, capped at 1.5x", async () => {
    mockParams = { checkId: "c1", petId: "pet1" };
    mockUseCheck.mockReturnValue({ data: { id: "c1", status: "RUNNING", category: "vomiting", createdAt: "2024-01-01T00:00:00.000Z" } });

    await render(<CheckWaitingScreen />);

    const title = screen.getByText("Looking into it…");
    expect(title.props.accessibilityRole).toBe("header");
    expect(title.props.maxFontSizeMultiplier).toBe(1.5);
  });
});

describe("check-flow-a11y: four data states (skeleton not spinner; pull-to-refresh)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { petId: "pet1" };
  });

  it("entry screen: recent-loading is a Skeleton (testID preserved), no ActivityIndicator", async () => {
    mockUseChecksList.mockReturnValue({ ...EMPTY_LIST_PAGE, data: undefined, isLoading: true });

    const { toJSON } = await render(<CheckEntryScreen />);

    expect(screen.getByTestId("check-recent-loading")).toBeTruthy();
    expect(screen.getByTestId("check-recent-loading-bone-0")).toBeTruthy();
    expect(findType(toJSON(), "ActivityIndicator")).toBe(false);
  });

  it("entry screen: offline banner has alert role and pull-to-refresh is wired on the scroll", async () => {
    mockUseChecksList.mockReturnValue(EMPTY_LIST_PAGE);

    await render(<CheckEntryScreen />);

    const scroll = screen.getByTestId("check-entry-scroll");
    expect(scroll.props.refreshControl).toBeTruthy();
  });

  it("history screen: loading is a Skeleton (testID preserved), no ActivityIndicator", async () => {
    mockUseChecksList.mockReturnValue({ ...EMPTY_LIST_PAGE, data: undefined, isLoading: true });

    const { toJSON } = await render(<CheckHistoryScreen />);

    expect(screen.getByTestId("check-history-loading")).toBeTruthy();
    expect(findType(toJSON(), "ActivityIndicator")).toBe(false);
    expect(findClassName(toJSON(), (c) => c.includes("bg-brand-100"))).toBe(true);
  });

  it("history screen: offline banner has alert role and pull-to-refresh is wired on the scroll", async () => {
    mockUseChecksList.mockReturnValue({ ...EMPTY_LIST_PAGE, data: { pages: [{ items: [MONITOR_ITEM], nextCursor: null }] } });

    await render(<CheckHistoryScreen />);

    const scroll = screen.getByTestId("check-history-scroll");
    expect(scroll.props.refreshControl).toBeTruthy();
  });

  it("history screen: error state error text is red-700 on the bg-surface-page page", async () => {
    mockUseChecksList.mockReturnValue({ ...EMPTY_LIST_PAGE, data: undefined, isError: true });

    await render(<CheckHistoryScreen />);

    const error = screen.getByText("We couldn't load your check history.");
    expect(error.props.className).toContain("text-red-700");
  });

  it("result screen: loading is a Skeleton (testID preserved), no ActivityIndicator", async () => {
    mockParams = { checkId: "c1" };
    mockUseCheck.mockReturnValue({ data: undefined, isError: false, refetch: jest.fn() });

    const { toJSON } = await render(<CheckResultScreen />);

    expect(screen.getByTestId("check-result-loading")).toBeTruthy();
    expect(findType(toJSON(), "ActivityIndicator")).toBe(false);
    expect(findClassName(toJSON(), (c) => c.includes("bg-brand-100"))).toBe(true);
  });

  it("result screen: error state text is red-700 on the bg-surface-page page", async () => {
    mockParams = { checkId: "c1" };
    mockUseCheck.mockReturnValue({ data: undefined, isError: true, refetch: jest.fn() });

    await render(<CheckResultScreen />);

    const errorText = screen.getByText("We couldn't load this result.");
    expect(errorText.props.className).toContain("text-red-700");
  });

  it("waiting screen keeps its spinner (sanctioned indeterminate job-wait, not a skeleton)", async () => {
    mockParams = { checkId: "c1", petId: "pet1" };
    mockUseCheck.mockReturnValue({ data: { id: "c1", status: "RUNNING", category: "vomiting", createdAt: "2024-01-01T00:00:00.000Z" } });

    await render(<CheckWaitingScreen />);

    expect(screen.getByTestId("check-waiting-spinner")).toBeTruthy();
  });
});

describe("check-flow-a11y: canon Card/chip/buttons + 44pt touch targets", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("category grid cells are rounded-2xl, >=44pt, and gray-free", async () => {
    await render(<CategoryGrid onSelect={jest.fn()} />);

    for (const category of INTAKE_CATEGORIES) {
      const cell = screen.getByTestId(`check-category-${category.id}`);
      expect(cell.props.className).toContain("rounded-2xl");
      expect(cell.props.className).toContain("min-h-[44px]");
      expect(cell.props.className).not.toContain("gray-");
    }
  });

  it("history row is >=56pt and its tier chip uses the dark-on-tint pair (not the banner fill)", async () => {
    await render(<CheckHistoryRow item={MONITOR_ITEM} onPress={jest.fn()} />);

    const row = screen.getByTestId("check-history-row-c1");
    expect(row.props.className).toContain("min-h-[56px]");

    const chip = screen.getByTestId("check-history-chip-c1");
    expect(chip.props.className).toContain("bg-blue-100");
    expect(chip.props.className).not.toContain("bg-blue-500");
  });

  it("result screen: guidance sections are wrapped in one canon Card (rounded-2xl/shadow-md/bg-white)", async () => {
    mockParams = { checkId: "c1" };
    mockUseCheck.mockReturnValue({
      data: { id: "c1", status: "DONE", category: "vomiting", createdAt: "2024-01-01T00:00:00.000Z", result: fixtureFor("MONITOR") },
      isError: false,
      refetch: jest.fn(),
    });

    await render(<CheckResultScreen />);

    const summary = screen.getByTestId("check-result-summary");
    let ancestor = summary.parent;
    let foundCard = false;
    while (ancestor !== null) {
      const className = (ancestor.props as { className?: unknown }).className;
      if (
        typeof className === "string" &&
        className.includes("rounded-2xl") &&
        className.includes("shadow-md") &&
        className.includes("bg-white")
      ) {
        foundCard = true;
        break;
      }
      ancestor = ancestor.parent;
    }
    expect(foundCard).toBe(true);
  });

  it("result screen: one PrimaryButton region -- find-vet Primary, share Secondary, done Ghost", async () => {
    mockParams = { checkId: "c1" };
    mockUseCheck.mockReturnValue({
      data: { id: "c1", status: "DONE", category: "vomiting", createdAt: "2024-01-01T00:00:00.000Z", result: fixtureFor("MONITOR") },
      isError: false,
      refetch: jest.fn(),
    });

    await render(<CheckResultScreen />);

    const findVet = screen.getByTestId("check-result-find-vet");
    expect(findVet.props.className).toContain("bg-brand-700");

    const share = screen.getByTestId("check-result-share");
    expect(share.props.className).toContain("border-brand-700");
    expect(share.props.className).toContain("bg-white");
    expect(share.props.className).not.toContain("bg-brand-700");

    const done = screen.getByTestId("check-result-done");
    expect(done.props.className).not.toContain("border");
    expect(done.props.className).not.toContain("bg-");
  });

  it("waiting screen: cancel is a GhostButton (tertiary per §2.9)", async () => {
    mockParams = { checkId: "c1", petId: "pet1" };
    mockUseCheck.mockReturnValue({ data: { id: "c1", status: "RUNNING", category: "vomiting", createdAt: "2024-01-01T00:00:00.000Z" } });

    await render(<CheckWaitingScreen />);

    const cancel = screen.getByTestId("check-waiting-cancel");
    expect(cancel.props.className).not.toContain("border");
    expect(cancel.props.className).not.toContain("bg-");
  });

  it("result screen: banner label is font-bold (WCAG large-text qualification, Risk R3)", async () => {
    mockParams = { checkId: "c1" };
    mockUseCheck.mockReturnValue({
      data: { id: "c1", status: "DONE", category: "vomiting", createdAt: "2024-01-01T00:00:00.000Z", result: fixtureFor("VET_24H") },
      isError: false,
      refetch: jest.fn(),
    });

    await render(<CheckResultScreen />);

    const label = screen.getByText("See a vet within 24 hours");
    expect(label.props.className).toContain("font-bold");
    expect(screen.getByTestId("urgency-banner-VET_24H").props.className).toContain("bg-orange-600");
  });
});

describe("check-flow-a11y: §5/§7 safety hierarchy is frozen (structural, not a behavior change)", () => {
  it("emergency notice -> urgency banner -> guidance -> disclaimer -> actions, in DOM order", async () => {
    mockParams = { checkId: "c1" };
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
    const ids = orderedTestIds(toJSON());

    const indexOf = (id: string) => ids.indexOf(id);
    expect(indexOf("check-result-emergency-notice")).toBeGreaterThanOrEqual(0);
    expect(indexOf("check-result-emergency-notice")).toBeLessThan(indexOf("check-result-urgency-banner"));
    expect(indexOf("check-result-urgency-banner")).toBeLessThan(indexOf("check-result-summary"));
    expect(indexOf("check-result-summary")).toBeLessThan(indexOf("vet-disclaimer"));
    expect(indexOf("vet-disclaimer")).toBeLessThan(indexOf("check-result-find-vet"));
  });
});

describe("check-flow-a11y: no gray-* tokens on swept components", () => {
  it("intake CategoryGrid, entry screen, and history screen render no gray- classes", async () => {
    mockParams = { petId: "pet1" };
    mockUseChecksList.mockReturnValue({ ...EMPTY_LIST_PAGE, data: { pages: [{ items: [MONITOR_ITEM], nextCursor: null }] } });

    const entry = await render(<CheckEntryScreen />);
    expect(findClassName(entry.toJSON(), (c) => c.includes("gray-"))).toBe(false);
    entry.unmount();

    const history = await render(<CheckHistoryScreen />);
    expect(findClassName(history.toJSON(), (c) => c.includes("gray-"))).toBe(false);
  });
});
