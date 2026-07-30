import { setOnline } from "@bombaypetcompany/api-client";
import { INTAKE_CATEGORIES, type CheckResponse } from "@bombaypetcompany/types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import CheckEntryScreen from "../app/check/index";
import { DEFAULT_APP_CONFIG } from "../src/config/app-config-queries";
import { strings } from "../src/strings";

// Screen tests for the check entry screen (T044 plan; recent section made
// live by T050; T106 kill-switch cases added). `expo-router` is mocked;
// offline is driven by the REAL shared store (`setOnline`) from
// `@bombaypetcompany/api-client`, reset to online in `afterEach`. RNTL v14 —
// every render is awaited. `useChecksList` is mocked since the screen now
// calls it for the recent-checks section. `useAppConfig` is mocked so
// existing cases are unaffected (all features true by default).
const mockPush = jest.fn();

// FOUNDER-UX-3 plan: `back`/`canGoBack` added -- the screen now composes
// the canon `AppHeader` (title + back), whose `onBack` resolves through
// `useNavBack`.
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ petId: "pet1" }),
}));

const mockUseChecksList = jest.fn();

jest.mock("../src/api/checks-api", () => ({
  useChecksList: (petId: string) => mockUseChecksList(petId),
}));

const mockUseAppConfig = jest.fn();

jest.mock("../src/config/app-config-queries", () => {
  const actual = jest.requireActual("../src/config/app-config-queries");
  return {
    ...actual,
    useAppConfig: () => mockUseAppConfig(),
  };
});

const EMPTY_PAGE = { data: { pages: [{ items: [], nextCursor: null }] }, isLoading: false, isError: false };

const RECENT_ITEM = {
  id: "c1",
  status: "DONE",
  category: "vomiting",
  createdAt: "2024-01-01T00:00:00.000Z",
  result: { urgency: "MONITOR" },
} as unknown as CheckResponse;

describe("check entry screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseChecksList.mockReturnValue(EMPTY_PAGE);
    mockUseAppConfig.mockReturnValue({ data: DEFAULT_APP_CONFIG });
  });

  afterEach(async () => {
    await act(() => {
      setOnline(true);
    });
  });

  it("renders every INTAKE_CATEGORIES label (schema-driven, AC1)", async () => {
    await render(<CheckEntryScreen />);

    expect(screen.getByTestId("check-entry-screen")).toBeTruthy();
    for (const category of INTAKE_CATEGORIES) {
      expect(screen.getByTestId(`check-category-${category.id}`)).toHaveTextContent(
        category.label,
        { exact: false },
      );
    }
  });

  it("tapping a category navigates carrying category id + petId (AC2)", async () => {
    await render(<CheckEntryScreen />);

    await fireEvent.press(screen.getByTestId("check-category-vomiting"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/check/[category]",
      params: { category: "vomiting", petId: "pet1" },
    });
  });

  it("shows the offline banner when offline, grid still renders", async () => {
    setOnline(false);

    await render(<CheckEntryScreen />);

    expect(screen.getByTestId("check-offline-banner")).toBeTruthy();
    expect(screen.getByTestId("check-category-grid")).toBeTruthy();
  });

  it("does not show the offline banner when online", async () => {
    await render(<CheckEntryScreen />);

    expect(screen.queryByTestId("check-offline-banner")).toBeNull();
  });

  it("shows the recent-checks empty state placeholder", async () => {
    await render(<CheckEntryScreen />);

    expect(screen.getByTestId("check-recent-empty")).toHaveTextContent(
      strings.check.recentEmpty,
    );
  });

  it("recent section shows top checks + See all navigates", async () => {
    mockUseChecksList.mockReturnValue({
      data: { pages: [{ items: [RECENT_ITEM], nextCursor: null }] },
      isLoading: false,
      isError: false,
    });

    await render(<CheckEntryScreen />);

    expect(screen.getByTestId("check-history-row-c1")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("check-recent-see-all"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/check/history/[petId]",
      params: { petId: "pet1" },
    });
  });

  it("shows a loading spinner for the recent section while fetching", async () => {
    mockUseChecksList.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    await render(<CheckEntryScreen />);

    expect(screen.getByTestId("check-recent-loading")).toBeTruthy();
  });

  it("shows an error message for the recent section on fetch failure", async () => {
    mockUseChecksList.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    await render(<CheckEntryScreen />);

    expect(screen.getByTestId("check-recent-error")).toHaveTextContent(strings.check.history.error);
  });

  // FOUNDER-UX-3 plan AC3: the canon header carries the screen's title.
  it("[AC3] renders app-header with the screen title", async () => {
    await render(<CheckEntryScreen />);

    expect(screen.getByTestId("app-header")).toBeTruthy();
    expect(screen.getByTestId("app-header-title")).toHaveTextContent(strings.check.title);
  });

  describe("T106 — checks kill switch", () => {
    it("renders the unavailable notice instead of the category grid when checks are killed, recent rows still tappable", async () => {
      mockUseAppConfig.mockReturnValue({
        data: { ...DEFAULT_APP_CONFIG, features: { ...DEFAULT_APP_CONFIG.features, checks: false } },
      });
      mockUseChecksList.mockReturnValue({
        data: { pages: [{ items: [RECENT_ITEM], nextCursor: null }] },
        isLoading: false,
        isError: false,
      });

      await render(<CheckEntryScreen />);

      expect(screen.getByTestId("check-unavailable")).toHaveTextContent(strings.check.unavailableTitle, {
        exact: false,
      });
      expect(screen.queryByTestId("check-category-grid")).toBeNull();
      expect(screen.getByTestId("check-history-row-c1")).toBeTruthy();
      await fireEvent.press(screen.getByTestId("check-history-row-c1"));
      expect(mockPush).toHaveBeenCalledWith({
        pathname: "/check/result/[checkId]",
        params: { checkId: "c1" },
      });
    });

    it("flag on ⇒ grid present, notice absent", async () => {
      await render(<CheckEntryScreen />);

      expect(screen.getByTestId("check-category-grid")).toBeTruthy();
      expect(screen.queryByTestId("check-unavailable")).toBeNull();
    });
  });
});
