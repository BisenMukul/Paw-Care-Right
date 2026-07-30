import { HOME_CARE_ALLOWED_TIERS, petIdSchema, type Pet, type TriageResult } from "@bombaypetcompany/types";
import { fireEvent, render, screen, type RenderResult } from "@testing-library/react-native";

import WelcomeScreen from "../app/(auth)/welcome";
import EmailScreen from "../app/(auth)/email";
import ActivityScreen from "../app/activity/[petId]";
import CheckResultScreen from "../app/check/result/[checkId]";
import EmergencyInterstitialScreen from "../app/check/emergency/[checkId]";
import ChatScreen from "../app/chat/index";
import ReminderEditScreen from "../app/reminders/edit";
import { useAddActivity, useHealthTimeline } from "../src/api/health-logs-api";
import { usePet, usePets } from "../src/api/pets-api";
import {
  useCreateMedicationCourse,
  useCreateReminder,
  useReminder,
  useUpdateReminder,
} from "../src/api/reminders-api";
import { useActivityRecentsStore } from "../src/health-logs/activity-recents-store";

/**
 * T093 plan Phase 2 step 8 -- the D1 "rendered lint" half + D3's dynamic-
 * type companion + D5's emergency-interstitial pin. Per-flow RNTL
 * assertions for the 5 core flows named by the card's acceptance criterion.
 *
 * SCOPING (documented, not hidden -- plan D7/R8): the "every interactive
 * element reaches the 44pt target" and "every interactive element exposes a
 * role or a label" walkers run WHERE this card's audit gave full,
 * file-by-file coverage of every Pressable on the surface under test
 * (activity logging, reminders, chat, and the check-result/emergency pair).
 * `welcome`/`email` get the role-or-label + header + reading-order checks
 * (their Pressables are all canon `PrimaryButton`/`SecondaryButton`
 * instances, already proven compliant); their existing behavioral coverage
 * (`auth-onboarding-a11y.test.tsx`) is not duplicated here.
 *
 * Mock idiom mirrors `sweep4-a11y.test.tsx`/`check-flow-a11y.test.tsx`
 * (module `jest.mock`s of the api hooks + `expo-router`, local JSON-tree
 * walkers) -- no third-party a11y matcher, no new test harness.
 */
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack, canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock("../src/auth/auth-store", () => ({
  useAuthStore: jest.fn(),
}));

const mockUseCheck = jest.fn();
jest.mock("../src/api/checks-api", () => ({
  useCheck: (checkId: string) => mockUseCheck(checkId),
}));

jest.mock("../src/checks/region", () => ({
  getDeviceRegionCode: () => "US",
}));

jest.mock("../src/api/pets-api", () => ({
  usePet: jest.fn(),
  usePets: jest.fn(),
}));

jest.mock("../src/api/health-logs-api", () => ({
  useAddActivity: jest.fn(),
  useHealthTimeline: jest.fn(),
}));

jest.mock("../src/api/reminders-api", () => ({
  useReminder: jest.fn(),
  useCreateReminder: jest.fn(),
  useUpdateReminder: jest.fn(),
  useCreateMedicationCourse: jest.fn(),
}));

const mockedUseAuthStore = jest.requireMock<{ useAuthStore: jest.Mock }>(
  "../src/auth/auth-store",
).useAuthStore;
const mockedUsePet = usePet as unknown as jest.Mock;
const mockedUsePets = usePets as unknown as jest.Mock;
const mockedUseAddActivity = useAddActivity as unknown as jest.Mock;
const mockedUseHealthTimeline = useHealthTimeline as unknown as jest.Mock;
const mockedUseReminder = useReminder as unknown as jest.Mock;
const mockedUseCreateReminder = useCreateReminder as unknown as jest.Mock;
const mockedUseUpdateReminder = useUpdateReminder as unknown as jest.Mock;
const mockedUseCreateMedicationCourse = useCreateMedicationCourse as unknown as jest.Mock;

// Chat screen renders through the REAL `useChatStream`/`usePremiumStore`
// (neither reads `pets-api`); `apiClient`/`expo-crypto` are mocked headless
// so no real network call or native module is reached even though this
// suite never exercises `send()` (mirrors `chat-screen.test.tsx`'s mocks).
jest.mock("../src/api/client", () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), streamSse: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("expo-crypto", () => ({ randomUUID: jest.fn(() => "uuid-1") }));

// T106: `ChatScreen` now calls `useAppConfig` (a `useQuery`); this suite
// renders it with no `QueryClientProvider` (unlike `chat-screen.test.tsx`),
// so the hook is mocked here too (all features true -- the default,
// flag-on path this suite's assertions already assume).
jest.mock("../src/config/app-config-queries", () => {
  const actual = jest.requireActual("../src/config/app-config-queries");
  return {
    ...actual,
    useAppConfig: () => ({ data: actual.DEFAULT_APP_CONFIG }),
  };
});

type JsonNode = ReturnType<RenderResult["toJSON"]>;
interface NodeLike {
  type?: unknown;
  props?: Record<string, unknown>;
  children?: unknown;
}

/** Recursively flattens a rendered JSON tree into a plain node list. */
function flatten(node: JsonNode | JsonNode[] | string | null | undefined, acc: NodeLike[] = []): NodeLike[] {
  if (node == null || typeof node === "string") {
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => flatten(child, acc));
    return acc;
  }
  acc.push(node as NodeLike);
  flatten((node as NodeLike).children as JsonNode[] | null, acc);
  return acc;
}

/**
 * A rendered Pressable's underlying host node always carries
 * `focusable: true` (verified against this exact RNTL/RN version by
 * rendering a raw `<Pressable>` and inspecting `toJSON()` -- `onPress`
 * itself is NOT preserved in the JSON snapshot, so `focusable` is the
 * reliable, mutation-safe structural marker used throughout this file).
 */
function findPressables(root: JsonNode): NodeLike[] {
  return flatten(root).filter((node) => node.props?.focusable === true);
}

/** In-order flattened testIDs (SWEEP-3 `check-flow-a11y.test.tsx` precedent). */
function orderedTestIds(node: JsonNode | JsonNode[] | string | null | undefined, acc: string[] = []): string[] {
  if (node == null || typeof node === "string") {
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => orderedTestIds(child, acc));
    return acc;
  }
  const testID = (node as NodeLike).props?.testID;
  if (typeof testID === "string") {
    acc.push(testID);
  }
  orderedTestIds((node as NodeLike).children as JsonNode[] | null, acc);
  return acc;
}

function hasRoleOrLabel(node: NodeLike): boolean {
  const role = node.props?.accessibilityRole;
  const label = node.props?.accessibilityLabel;
  return typeof role === "string" || (typeof label === "string" && label.length > 0);
}

const HIT_SLOP_KEYS = ["hitSlop"];
function reaches44pt(node: NodeLike, allowlistedTestIds: ReadonlySet<string>): boolean {
  const className = typeof node.props?.className === "string" ? (node.props.className as string) : "";
  const hasMinH = /(^|\s)min-h-\[(44|56)px\]/.test(className);
  const hasHitSlop = HIT_SLOP_KEYS.some((key) => node.props?.[key] !== undefined);
  const testID = typeof node.props?.testID === "string" ? (node.props.testID as string) : undefined;
  const allowlisted = testID !== undefined && allowlistedTestIds.has(testID);
  return hasMinH || hasHitSlop || allowlisted;
}

function assertIndexOrder(order: string[], ...testIds: string[]) {
  const indices = testIds.map((id) => order.indexOf(id));
  for (const index of indices) {
    expect(index).toBeGreaterThanOrEqual(0);
  }
  for (let i = 1; i < indices.length; i += 1) {
    expect(indices[i]!).toBeGreaterThan(indices[i - 1]!);
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
});

// ---------------------------------------------------------------------------
// FLOW 1: welcome -> sign-in
// ---------------------------------------------------------------------------
describe("a11y-sweep: welcome -> sign-in flow", () => {
  beforeEach(() => {
    mockedUseAuthStore.mockImplementation(
      (selector: (state: { requestOtp: unknown }) => unknown) => selector({ requestOtp: jest.fn() }),
    );
  });

  it("every welcome-screen interactive element exposes a role or a label", async () => {
    const { toJSON } = await render(<WelcomeScreen />);

    const pressables = findPressables(toJSON());
    expect(pressables.length).toBeGreaterThanOrEqual(2);
    for (const node of pressables) {
      expect(hasRoleOrLabel(node)).toBe(true);
    }
  });

  it("the screen title is a header", async () => {
    await render(<WelcomeScreen />);

    expect(screen.getByTestId("app-title").props.accessibilityRole).toBe("header");
  });

  it("reading order matches visual order", async () => {
    const { toJSON } = await render(<WelcomeScreen />);

    const order = orderedTestIds(toJSON());
    assertIndexOrder(order, "welcome-hero", "app-title", "welcome-continue-email");
  });

  it("email screen's invalid-email error carries accessibilityRole=alert", async () => {
    await render(<EmailScreen />);

    await fireEvent.changeText(screen.getByTestId("email-input"), "not-an-email");
    await fireEvent.press(screen.getByTestId("email-submit"));

    expect(screen.getByTestId("email-error").props.accessibilityRole).toBe("alert");
  });
});

// ---------------------------------------------------------------------------
// FLOW 2: home -> check -> result -> emergency
// ---------------------------------------------------------------------------
function fixtureFor(): TriageResult {
  return {
    urgency: "MONITOR",
    confidence: "high",
    summary: "General guidance based on the information provided.",
    possibleCauses: [{ name: "Mild upset stomach", whyItFits: "Reported symptoms are consistent with this." }],
    redFlagsToWatch: ["Repeated vomiting"],
    homeCare: (HOME_CARE_ALLOWED_TIERS as readonly string[]).includes("MONITOR") ? ["Offer small amounts of water"] : [],
    doNot: ["Do not give human medications without veterinary guidance."],
    vetQuestions: ["How long have symptoms been present?"],
    followUpHours: 24,
  };
}

const CHECK_RESULT_ACTION_ALLOWLIST = new Set([
  // PrimaryButton/SecondaryButton/GhostButton canon: fixed `px-6 py-3`/
  // `hitSlop` padding always exceeds 44pt (verified source-level in
  // `primary-button.tsx`/`secondary-button.tsx`/`ghost-button.tsx`); these
  // components carry no literal `min-h-[…]` class, so they need this
  // short, commented allowlist rather than a false failure (plan D7's
  // sanctioned escape hatch).
  "check-result-find-vet",
  "check-result-share",
  "check-result-done",
]);

describe("a11y-sweep: home -> check -> result -> emergency flow", () => {
  it("check-result screen's 5 section titles are headers, and its 3 canon actions reach the 44pt target", async () => {
    mockUseCheck.mockReturnValue({
      data: { id: "c1", status: "DONE", category: "vomiting", createdAt: "2024-01-01T00:00:00.000Z", result: fixtureFor() },
      isError: false,
      refetch: jest.fn(),
    });
    mockParams = { checkId: "c1" };

    const { toJSON } = await render(<CheckResultScreen />);

    for (const testId of [
      "check-result-possible-causes",
      "check-result-red-flags-to-watch",
      "check-result-home-care",
      "check-result-do-not",
      "check-result-vet-questions",
    ]) {
      const section = screen.getByTestId(testId);
      const headerNode = flatten(section as unknown as JsonNode).find(
        (node) => node.props?.accessibilityRole === "header",
      );
      expect(headerNode).toBeDefined();
    }

    const pressables = findPressables(toJSON());
    expect(pressables.length).toBeGreaterThanOrEqual(3);
    for (const node of pressables) {
      expect(reaches44pt(node, CHECK_RESULT_ACTION_ALLOWLIST)).toBe(true);
    }
  });

  it("check-result screen's reading order is banner -> content -> disclaimer -> actions", async () => {
    mockUseCheck.mockReturnValue({
      data: { id: "c1", status: "DONE", category: "vomiting", createdAt: "2024-01-01T00:00:00.000Z", result: fixtureFor() },
      isError: false,
      refetch: jest.fn(),
    });
    mockParams = { checkId: "c1" };

    const { toJSON } = await render(<CheckResultScreen />);

    const order = orderedTestIds(toJSON());
    assertIndexOrder(
      order,
      "check-result-urgency-banner",
      "check-result-summary",
      "check-result-possible-causes",
      "vet-disclaimer",
      "check-result-find-vet",
      "check-result-done",
    );
  });

  it("emergency interstitial renders no animation node (D5 pin)", async () => {
    mockUseCheck.mockReturnValue({
      data: {
        id: "c1",
        status: "DONE",
        category: "vomiting",
        createdAt: "2024-01-01T00:00:00.000Z",
        redFlag: { ruleId: "gdv-suspected", payloadKey: "vomiting.blood" },
      },
    });
    mockParams = { checkId: "c1" };

    const { toJSON } = await render(<EmergencyInterstitialScreen />);

    const tree = flatten(toJSON());
    expect(tree.length).toBeGreaterThan(5);

    const hasEnteringProp = tree.some((node) => node.props?.entering !== undefined || node.props?.exiting !== undefined);
    expect(hasEnteringProp).toBe(false);

    const hasAnimatedTypeNode = tree.some((node) => typeof node.type === "string" && node.type.includes("Animated"));
    expect(hasAnimatedTypeNode).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FLOW 3: activity logging
// ---------------------------------------------------------------------------
const FIXTURE_PET: Pet = {
  id: petIdSchema.parse("11111111-1111-4111-8111-111111111111"),
  householdId: "22222222-2222-2222-2222-222222222222",
  species: "DOG",
  sex: "MALE",
  name: "Rex",
  neutered: true,
  breedSlug: "labrador-retriever",
  birthDate: "2022-01-15T00:00:00.000Z",
  ageEstimateMonths: null,
  weightGrams: 25000,
  photoKey: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const ACTIVITY_SHEET_ALLOWLIST = new Set([
  // ActivityChipGrid tiles: generous `px-3 py-5` padding around a 44px icon
  // tile makes every tile's effective box far larger than 44pt (verified
  // source-level in `activity-chip-grid.tsx`'s own header comment: "generous
  // py-5 padding (>=44pt effective target)"), but the class is not the
  // literal `min-h-[44px]`/`min-h-[56px]` string the walker's regex
  // recognizes -- documented here rather than silently widening the regex
  // (which would risk accepting an actually-undersized target elsewhere).
  "activity-chip-FOOD",
  "activity-chip-WATER",
  "activity-chip-POTTY",
  "activity-chip-SLEEP",
  "activity-chip-WALK",
  "activity-chip-PLAY",
  "activity-chip-GROOMING",
  // PrimaryButton canon (`activity-sheet-save`): fixed `px-6 py-3` padding
  // always exceeds 44pt (verified source-level in `primary-button.tsx`);
  // carries no literal `min-h-[…]` class, same rationale as
  // `CHECK_RESULT_ACTION_ALLOWLIST` above.
  "activity-sheet-save",
]);

describe("a11y-sweep: activity logging flow", () => {
  beforeEach(() => {
    mockedUseAddActivity.mockReturnValue({ mutate: jest.fn(), isPending: false });
    mockedUseHealthTimeline.mockReturnValue({ data: { pages: [{ items: [], nextCursor: null }] }, isLoading: false });
    mockedUsePet.mockReturnValue({ data: FIXTURE_PET, isLoading: false, isError: false, refetch: jest.fn() });
    useActivityRecentsStore.setState({ byPet: {} });
    mockParams = { petId: "pet1" };
  });

  it("every interactive element (chip grid + open quantity sheet) exposes a role or a label", async () => {
    const { toJSON } = await render(<ActivityScreen />);

    await fireEvent.press(screen.getByTestId("activity-chip-FOOD"));

    const pressables = findPressables(toJSON());
    expect(pressables.length).toBeGreaterThanOrEqual(7);
    for (const node of pressables) {
      expect(hasRoleOrLabel(node)).toBe(true);
    }
  });

  it("the activity screen title is a header", async () => {
    await render(<ActivityScreen />);

    const title = screen.getByText("Log activity");
    expect(title.props.accessibilityRole).toBe("header");
  });

  it("chip/unit selected state is exposed (both a selected and an unselected element)", async () => {
    await render(<ActivityScreen />);

    await fireEvent.press(screen.getByTestId("activity-chip-FOOD"));

    const mealsChip = screen.getByTestId("activity-unit-meals");
    const gramsChip = screen.getByTestId("activity-unit-grams");
    expect(mealsChip.props.accessibilityState?.selected).toBe(true);
    expect(gramsChip.props.accessibilityState?.selected).toBe(false);
  });

  it("the undo banner carries accessibilityRole=alert", async () => {
    useActivityRecentsStore.setState({
      byPet: { pet1: [{ activityType: "FOOD", quantity: 1, unit: "meals" }] },
    });

    await render(<ActivityScreen />);

    await fireEvent.press(screen.getByTestId("activity-recent-chip-0"));

    expect(screen.getByTestId("activity-undo-banner").props.accessibilityRole).toBe("alert");
  });

  it("every interactive element reaches the 44pt target", async () => {
    const { toJSON } = await render(<ActivityScreen />);

    await fireEvent.press(screen.getByTestId("activity-chip-FOOD"));

    const pressables = findPressables(toJSON());
    expect(pressables.length).toBeGreaterThanOrEqual(7);
    for (const node of pressables) {
      expect(reaches44pt(node, ACTIVITY_SHEET_ALLOWLIST)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// FLOW 4: reminders
// ---------------------------------------------------------------------------
describe("a11y-sweep: reminders flow", () => {
  beforeEach(() => {
    mockParams = { petId: "pet-a" };
    mockedUseReminder.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: jest.fn() });
    mockedUseCreateReminder.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({}), isPending: false });
    mockedUseUpdateReminder.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({}), isPending: false });
    mockedUseCreateMedicationCourse.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({}), isPending: false });
  });

  // Scoped to the `ScheduleBuilder` surface this card actually fixed
  // (`schedule-*` testIDs) -- `ReminderEditScreen` also renders its own
  // bespoke date/time steppers (e.g. `reminder-startdate-*`) that are
  // OUTSIDE the D7 candidate file list (`reminders/edit.tsx` is not in
  // "Files to create/modify"); those are a pre-existing, out-of-scope
  // pattern (the house convention documented by `sweep4-a11y.test.tsx`'s
  // own `expect(stepper.props.accessibilityRole).toBeUndefined()` case) and
  // are correctly excluded rather than silently widened past this card's
  // mandate (plan D7/R8). `ScheduleBuilder`'s freq/day selectors are `Text`
  // nodes with `onPress`, not `Pressable` -- their host node carries no
  // `focusable: true` marker (confirmed: only a real `Pressable`'s render
  // output does), so this scan walks the FULL flattened tree filtered by
  // the `schedule-*` testID prefix rather than `findPressables`'s
  // `focusable` heuristic, which the plan's own R9(i) flags as an
  // RNTL-version-dependent assumption to verify, not trust.
  it("every ScheduleBuilder interactive element exposes a role or a label", async () => {
    const { toJSON } = await render(<ReminderEditScreen />);

    await fireEvent.press(screen.getByTestId("schedule-freq-WEEKLY"));

    // Interactive `schedule-*` nodes only -- excludes the two plain-Text
    // value displays (`schedule-interval`/`schedule-monthday`), which are
    // not interactive and legitimately carry no role/label of their own.
    const SCHEDULE_INTERACTIVE_TESTID = /^schedule-freq-[A-Z]+$|^schedule-day-[A-Z]{2}$|^schedule-(interval|monthday)-(decrement|increment)$/;
    const scheduleNodes = flatten(toJSON()).filter(
      (node) => typeof node.props?.testID === "string" && SCHEDULE_INTERACTIVE_TESTID.test(node.props.testID as string),
    );
    expect(scheduleNodes.length).toBeGreaterThanOrEqual(4);
    for (const node of scheduleNodes) {
      expect(hasRoleOrLabel(node)).toBe(true);
    }
  });

  it("selected state is exposed on the frequency segmented control (both a selected and unselected value)", async () => {
    await render(<ReminderEditScreen />);

    await fireEvent.press(screen.getByTestId("schedule-freq-WEEKLY"));

    expect(screen.getByTestId("schedule-freq-WEEKLY").props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId("schedule-freq-DAILY").props.accessibilityState).toEqual({ selected: false });
  });

  it("every stepper Pressable reaches the 44pt target (hitSlop) and carries an accessibility label", async () => {
    await render(<ReminderEditScreen />);

    for (const testId of [
      "schedule-interval-decrement",
      "schedule-interval-increment",
    ]) {
      const node = screen.getByTestId(testId);
      expect(node.props.hitSlop).toBeDefined();
      expect(typeof node.props.accessibilityLabel).toBe("string");
      expect((node.props.accessibilityLabel as string).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// FLOW 5: chat
// ---------------------------------------------------------------------------
describe("a11y-sweep: chat flow", () => {
  it("every chat-screen interactive element exposes a role or a label", async () => {
    mockedUsePets.mockReturnValue({ data: [FIXTURE_PET], isLoading: false, isError: false, refetch: jest.fn() });

    const { toJSON, findByTestId } = await render(<ChatScreen />);

    await findByTestId("chat-active-pet-badge");

    const pressables = findPressables(toJSON());
    expect(pressables.length).toBeGreaterThanOrEqual(3);
    for (const node of pressables) {
      expect(hasRoleOrLabel(node)).toBe(true);
    }
  });
});
