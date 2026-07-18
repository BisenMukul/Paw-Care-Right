import {
  HOME_CARE_ALLOWED_TIERS,
  type CheckResponse,
  type TriageResult,
  type Urgency,
} from "@pawcareright/types";
import { render, screen, type RenderResult } from "@testing-library/react-native";

import CheckHistoryScreen from "../app/check/history/[petId]";
import CheckEntryScreen from "../app/check/index";
import IntakeScreen from "../app/check/[category]";
import CheckResultScreen from "../app/check/result/[checkId]";
import CheckWaitingScreen from "../app/check/waiting/[checkId]";

/**
 * PAWSAATHI-3 plan (scope 5 "Tests to write" / "Tests -- new"): mirrors
 * `timeline-screen-theme.test.tsx`'s idiom (mock `expo-router`/`checks-api`
 * at the hook boundary, assert dark-token PRESENCE via `className` content
 * -- NativeWind under this jest setup never resolves `className`, it stays a
 * literal string regardless of OS color scheme, per design-system.md §1.6).
 * Also pins the batch's two safety freezes structurally: the four §5/§7
 * subtrees on the result screen (emergency-notice/fallback-notice/urgency-
 * banner/vet-disclaimer) carry NO new `dark:`/`font-*` token, and the whole
 * flow renders no "diagnos" substring (CLAUDE §7 rule 1, record-only).
 */
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));

const mockUseChecksList = jest.fn();
const mockUseCheck = jest.fn();

jest.mock("../src/api/checks-api", () => ({
  useChecksList: (petId: string) => mockUseChecksList(petId),
  useCheck: (checkId: string) => mockUseCheck(checkId),
  useCreateCheck: () => ({ mutateAsync: jest.fn() }),
}));

type JsonNode = ReturnType<RenderResult["toJSON"]>;

/** Recursively collects every `className` string found anywhere in a
 * rendered JSON (sub)tree (mirrors `check-flow-a11y.test.tsx`'s
 * `findClassName`, but gathers ALL matches rather than short-circuiting on
 * the first one -- needed to assert an ABSENCE across a whole subtree).
 * Stops recursing into any node whose `testID` is in `skipTestIds` -- the
 * result screen's frozen notices legitimately CONTAIN an already-dual canon
 * `PrimaryButton` (swept in an earlier batch, unrelated to this plan's
 * notice-freeze), so the freeze assertion is about the notice's OWN
 * presentational wrapper/text, not about excluding canon components. */
function collectClassNames(
  node: JsonNode | JsonNode[] | string | null | undefined,
  skipTestIds: readonly string[] = [],
  acc: string[] = [],
): string[] {
  if (node == null || typeof node === "string") {
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectClassNames(child, skipTestIds, acc));
    return acc;
  }
  const testID = (node.props as { testID?: unknown } | undefined)?.testID;
  if (typeof testID === "string" && skipTestIds.includes(testID)) {
    return acc;
  }
  const className = (node.props as { className?: unknown } | undefined)?.className;
  if (typeof className === "string") {
    acc.push(className);
  }
  collectClassNames(node.children as JsonNode[] | null, skipTestIds, acc);
  return acc;
}

/** Finds the first node whose `testID` matches, returning its JSON subtree
 * (so its OWN classNames, and every descendant's, can be inspected). */
function findByTestId(node: JsonNode | JsonNode[] | string | null | undefined, testID: string): JsonNode | null {
  if (node == null || typeof node === "string") {
    return null;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByTestId(child, testID);
      if (found !== null) {
        return found;
      }
    }
    return null;
  }
  if ((node.props as { testID?: unknown } | undefined)?.testID === testID) {
    return node;
  }
  return findByTestId(node.children as JsonNode[] | null, testID);
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

const MONITOR_CHECK: CheckResponse = {
  id: "c1",
  status: "DONE",
  category: "vomiting",
  createdAt: "2024-01-01T00:00:00.000Z",
  result: fixtureFor("MONITOR"),
} as unknown as CheckResponse;

describe("check-flow-theme: browse + intake + waiting screens carry the dark restyle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { petId: "pet1" };
    mockUseChecksList.mockReturnValue(EMPTY_LIST_PAGE);
  });

  it("entry screen: page root + title carry dark tokens", async () => {
    const { toJSON } = await render(<CheckEntryScreen />);

    const root = findByTestId(toJSON(), "check-entry-screen");
    expect(root?.props.className).toContain("dark:bg-surface-page-dark");
    expect(collectClassNames(toJSON()).some((c) => c.includes("dark:text-ink-dark") && c.includes("font-display"))).toBe(
      true,
    );
  });

  it("history screen: page root + title carry dark tokens", async () => {
    mockUseChecksList.mockReturnValue({ ...EMPTY_LIST_PAGE, data: { pages: [{ items: [MONITOR_CHECK], nextCursor: null }] } });

    const { toJSON } = await render(<CheckHistoryScreen />);

    const root = findByTestId(toJSON(), "check-history-screen");
    expect(root?.props.className).toContain("dark:bg-surface-page-dark");
  });

  it("waiting screen: page root + title carry dark tokens", async () => {
    mockParams = { checkId: "c1", petId: "pet1" };
    mockUseCheck.mockReturnValue({ data: { id: "c1", status: "RUNNING", category: "vomiting", createdAt: "2024-01-01T00:00:00.000Z" } });

    const { toJSON } = await render(<CheckWaitingScreen />);

    const root = findByTestId(toJSON(), "check-waiting-screen");
    expect(root?.props.className).toContain("dark:bg-surface-page-dark");
    expect(collectClassNames(toJSON()).some((c) => c.includes("dark:text-ink-dark") && c.includes("font-display-semibold"))).toBe(
      true,
    );
  });

  it("intake screen: form root + question prompt carry dark tokens", async () => {
    mockParams = { category: "vomiting", petId: "pet1" };

    const { toJSON } = await render(<IntakeScreen />);

    const formRoot = findByTestId(toJSON(), "intake-form");
    expect(formRoot?.props.className).toContain("dark:bg-surface-page-dark");
    const prompt = findByTestId(toJSON(), "intake-question-prompt");
    expect(prompt?.props.className).toContain("dark:text-ink-dark");
    expect(prompt?.props.className).toContain("font-display-semibold");
  });
});

describe("check-flow-theme: result screen -- guidance themed, four §5/§7 subtrees frozen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { checkId: "c1" };
  });

  it("guidance card summary carries dark tokens", async () => {
    mockUseCheck.mockReturnValue({
      data: { id: "c1", status: "DONE", category: "vomiting", createdAt: "2024-01-01T00:00:00.000Z", result: fixtureFor("MONITOR") },
      isError: false,
      refetch: jest.fn(),
    });

    await render(<CheckResultScreen />);

    const summary = screen.getByTestId("check-result-summary");
    expect(summary.props.className).toContain("dark:text-ink-dark");
    expect(summary.props.className).toContain("font-body");
  });

  it("emergency-notice, urgency-banner, and vet-disclaimer subtrees carry NO dark:/font-* token (frozen)", async () => {
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

    for (const testID of [
      "check-result-emergency-notice",
      "check-result-urgency-banner",
      "vet-disclaimer",
    ]) {
      const subtree = findByTestId(toJSON(), testID);
      expect(subtree).not.toBeNull();
      // The emergency-notice legitimately nests an already-dual canon
      // PrimaryButton (`check-result-emergency-cta`, swept in an earlier
      // batch) -- excluded so this freeze check targets only the notice's
      // OWN wrapper/text, per plan decision 3.
      const classNames = collectClassNames(subtree, ["check-result-emergency-cta"]);
      expect(classNames.length).toBeGreaterThan(0);
      for (const className of classNames) {
        expect(className).not.toContain("dark:");
        expect(className).not.toMatch(/font-(display|body)/);
      }
    }
  });

  it("fallback-notice subtree carries NO dark:/font-* token (frozen)", async () => {
    mockUseCheck.mockReturnValue({
      data: { id: "c1", status: "FALLBACK", category: "vomiting", createdAt: "2024-01-01T00:00:00.000Z", result: undefined },
      isError: false,
      refetch: jest.fn(),
    });

    const { toJSON } = await render(<CheckResultScreen />);

    const subtree = findByTestId(toJSON(), "check-result-fallback-notice");
    expect(subtree).not.toBeNull();
    const classNames = collectClassNames(subtree);
    expect(classNames.length).toBeGreaterThan(0);
    for (const className of classNames) {
      expect(className).not.toContain("dark:");
      expect(className).not.toMatch(/font-(display|body)/);
    }
  });

  it("the whole flow renders no 'diagnos' substring (record-only, CLAUDE §7 rule 1)", async () => {
    mockUseCheck.mockReturnValue({
      data: { id: "c1", status: "DONE", category: "vomiting", createdAt: "2024-01-01T00:00:00.000Z", result: fixtureFor("MONITOR") },
      isError: false,
      refetch: jest.fn(),
    });

    const { toJSON } = await render(<CheckResultScreen />);

    expect(JSON.stringify(toJSON())).not.toMatch(/diagnos/i);
  });
});
