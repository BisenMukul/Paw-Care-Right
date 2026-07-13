import { setOnline } from "@pawcareright/api-client";
import { INTAKE_CATEGORIES } from "@pawcareright/types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import CheckEntryScreen from "../app/check/index";
import { strings } from "../src/strings";

// Screen tests for the check entry screen (T044 plan). `expo-router` is
// mocked; offline is driven by the REAL shared store (`setOnline`) from
// `@pawcareright/api-client`, reset to online in `afterEach`. RNTL v14 —
// every render is awaited.
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ petId: "pet1" }),
}));

describe("check entry screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
