import { petIdSchema, type CareTemplateSuggestions, type HouseholdMe, type Pet, type TriageResult } from "@bombaypetcompany/types";
import { render, screen } from "@testing-library/react-native";

import CarePlanWizardScreen from "../app/care-plan/[petId]";
import CheckEntryScreen from "../app/check/index";
import CheckHistoryScreen from "../app/check/history/[petId]";
import CheckResultScreen from "../app/check/result/[checkId]";
import FamilyScreen from "../app/family";
import PetHomeScreen from "../app/pets/[id]";
import ServicesScreen from "../app/services/index";
import SettingsScreen from "../app/(tabs)/settings";
import TimelineScreen from "../app/(tabs)/timeline";
import { useTemplateSuggestions, useInstantiateTemplate } from "../src/api/care-plan-api";
import { useCheck, useChecksList } from "../src/api/checks-api";
import { useCreateInvite, useHouseholdMe, useLeaveHousehold } from "../src/api/households-api";
import { useEntitlement } from "../src/api/billing-api";
import { usePet } from "../src/api/pets-api";
import { useHealthTimeline } from "../src/api/health-logs-api";

/**
 * FOUNDER-UX-3 plan (Risk R5): representative coverage for the shared
 * `ScreenScaffold onBack`/bespoke-`AppHeader` mechanism across the plan's
 * enumerated screens, plus a re-assertion that tab roots never render it.
 * Every domain hook the composed screens call is mocked at the module
 * boundary (mirrors each screen's own test file); `expo-router` uses a
 * shared, per-test-writable `mockParams` object since different screens
 * read different params.
 */
let mockParams: Record<string, string> = {};
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true };

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));

jest.mock("../src/checks/region", () => ({
  getDeviceRegionCode: () => "US",
}));

jest.mock("../src/api/care-plan-api", () => ({
  useTemplateSuggestions: jest.fn(),
  useInstantiateTemplate: jest.fn(),
}));

jest.mock("../src/api/checks-api", () => ({
  useCheck: jest.fn(),
  useChecksList: jest.fn(),
}));

// T106: `CheckEntryScreen` now calls `useAppConfig` (a `useQuery`); this
// suite renders it with no `QueryClientProvider`, so the hook is mocked
// here too (all features true -- the default, flag-on path this suite's
// assertions already assume).
jest.mock("../src/config/app-config-queries", () => {
  const actual = jest.requireActual("../src/config/app-config-queries");
  return {
    ...actual,
    useAppConfig: () => ({ data: actual.DEFAULT_APP_CONFIG }),
  };
});

jest.mock("../src/api/pets-api", () => ({
  usePet: jest.fn(),
}));

jest.mock("../src/api/households-api", () => ({
  useHouseholdMe: jest.fn(),
  useCreateInvite: jest.fn(),
  useLeaveHousehold: jest.fn(),
}));

jest.mock("../src/api/billing-api", () => ({
  useEntitlement: jest.fn(),
}));

// T091: see sweep4-a11y.test.tsx's identical mock for why this is needed.
jest.mock("../src/api/privacy-api", () => ({
  usePrivacySettings: jest.fn(() => ({ data: undefined })),
  useUpdatePrivacySettings: jest.fn(() => ({ mutateAsync: jest.fn() })),
}));

jest.mock("../src/api/health-logs-api", () => ({
  ...jest.requireActual("../src/api/health-logs-api"),
  useHealthTimeline: jest.fn(),
  usePrepareVetSummary: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
}));

const FIXTURE_PET: Pet = {
  id: petIdSchema.parse("11111111-1111-4111-8111-111111111111"),
  householdId: "22222222-2222-2222-2222-222222222222",
  species: "DOG",
  sex: "MALE",
  name: "Rex",
  neutered: true,
  breedSlug: "labrador-retriever",
  birthDate: "2022-06-15T00:00:00.000Z",
  ageEstimateMonths: null,
  weightGrams: 25000,
  photoKey: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const MONITOR_RESULT: TriageResult = {
  urgency: "MONITOR",
  confidence: "high",
  summary: "General guidance based on the information provided.",
  possibleCauses: [{ name: "Mild upset stomach", whyItFits: "Reported symptoms are consistent with this." }],
  redFlagsToWatch: ["Repeated vomiting"],
  homeCare: ["Offer small amounts of water"],
  doNot: ["Do not give human medications without veterinary guidance."],
  vetQuestions: ["How long have symptoms been present?"],
  followUpHours: 24,
};

const EMPTY_CHECKS_PAGE = {
  data: { pages: [{ items: [], nextCursor: null }] },
  isLoading: false,
  isError: false,
  refetch: jest.fn(),
  isRefetching: false,
  hasNextPage: false,
  fetchNextPage: jest.fn(),
  isFetchingNextPage: false,
};

const CARE_PLAN_SUGGESTIONS: CareTemplateSuggestions = {
  species: "DOG",
  lifeStage: "ADULT",
  group: "DEFAULT",
  items: [
    {
      templateKey: "rabies-core",
      title: "Rabies booster",
      note: "Ask your vet for the region-specific schedule.",
      reminderType: "VACCINE",
      defaultStartAt: null,
      emphasis: false,
      alreadyExists: false,
    },
  ],
};

const HOUSEHOLD: HouseholdMe = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "The Smiths",
  members: [],
};

describe("header sweep (FOUNDER-UX-3 plan AC3/AC4 representatives)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
    (useEntitlement as unknown as jest.Mock).mockReturnValue({ data: undefined });
  });

  it("[AC3] pet-home renders app-header", async () => {
    mockParams = { id: "pet1" };
    (usePet as unknown as jest.Mock).mockReturnValue({
      data: FIXTURE_PET,
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: jest.fn(),
    });

    await render(<PetHomeScreen />);

    expect(screen.getByTestId("app-header")).toBeTruthy();
  });

  it("[AC3] check-result renders app-header", async () => {
    mockParams = { checkId: "c1" };
    (useCheck as unknown as jest.Mock).mockReturnValue({
      data: { id: "c1", status: "DONE", category: "vomiting", createdAt: "2024-01-01T00:00:00.000Z", result: MONITOR_RESULT },
      isError: false,
      refetch: jest.fn(),
    });

    await render(<CheckResultScreen />);

    expect(screen.getByTestId("app-header")).toBeTruthy();
  });

  it("[AC3] check-entry renders app-header", async () => {
    mockParams = { petId: "pet1" };
    (useChecksList as unknown as jest.Mock).mockReturnValue(EMPTY_CHECKS_PAGE);

    await render(<CheckEntryScreen />);

    expect(screen.getByTestId("app-header")).toBeTruthy();
  });

  it("[AC3] check-history renders app-header", async () => {
    mockParams = { petId: "pet1" };
    (useChecksList as unknown as jest.Mock).mockReturnValue(EMPTY_CHECKS_PAGE);

    await render(<CheckHistoryScreen />);

    expect(screen.getByTestId("app-header")).toBeTruthy();
  });

  it("[AC3] care-plan renders app-header", async () => {
    mockParams = { petId: "pet1", localPhoto: "" };
    (useTemplateSuggestions as unknown as jest.Mock).mockReturnValue({
      data: CARE_PLAN_SUGGESTIONS,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    (useInstantiateTemplate as unknown as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false });

    await render(<CarePlanWizardScreen />);

    expect(screen.getByTestId("app-header")).toBeTruthy();
  });

  it("[AC3] family renders app-header", async () => {
    (useHouseholdMe as unknown as jest.Mock).mockReturnValue({
      data: HOUSEHOLD,
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    });
    (useCreateInvite as unknown as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    (useLeaveHousehold as unknown as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false });

    await render(<FamilyScreen />);

    expect(screen.getByTestId("app-header")).toBeTruthy();
  });

  it("[AC3] services hub renders app-header", async () => {
    await render(<ServicesScreen />);

    expect(screen.getByTestId("app-header")).toBeTruthy();
  });

  it("[AC4] timeline tab root renders no app-header", async () => {
    (useHealthTimeline as unknown as jest.Mock).mockReturnValue({
      data: { pages: [{ items: [], nextCursor: null }] },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
      isRefetching: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isFetchingNextPage: false,
    });

    await render(<TimelineScreen />);

    expect(screen.queryByTestId("app-header")).toBeNull();
  });

  it("[AC4] settings tab root renders no app-header", async () => {
    await render(<SettingsScreen />);

    expect(screen.queryByTestId("app-header")).toBeNull();
  });
});
