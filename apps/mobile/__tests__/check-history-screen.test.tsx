import { setOnline } from "@pawcareright/api-client";
import type { CheckResponse } from "@pawcareright/types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import CheckHistoryScreen from "../app/check/history/[petId]";
import { strings } from "../src/strings";

// T050 plan "Tests to write" -> check-history-screen.test.tsx. `expo-router`
// and `useChecksList` are mocked; offline is driven by the REAL shared store
// (`setOnline`) from `@pawcareright/api-client`, reset to online in
// `afterEach`. RNTL v14 — every render is awaited.
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ petId: "pet1" }),
}));

const mockUseChecksList = jest.fn();

jest.mock("../src/api/checks-api", () => ({
  useChecksList: (petId: string) => mockUseChecksList(petId),
}));

function page(items: CheckResponse[], nextCursor: string | null = null) {
  return { data: { pages: [{ items, nextCursor }], pageParams: [undefined] } };
}

const MONITOR_ITEM = {
  id: "c1",
  status: "DONE",
  category: "vomiting",
  createdAt: "2024-01-01T00:00:00.000Z",
  result: { urgency: "MONITOR" },
} as unknown as CheckResponse;

const RED_FLAG_ITEM = {
  id: "c2",
  status: "RUNNING",
  category: "diarrhea",
  createdAt: "2024-01-02T00:00:00.000Z",
  redFlag: { ruleId: "rule-1", payloadKey: "vomiting.blood" },
} as CheckResponse;

const BASE_MOCK = {
  isLoading: false,
  isError: false,
  hasNextPage: false,
  fetchNextPage: jest.fn(),
  isFetchingNextPage: false,
  refetch: jest.fn(),
};

describe("check history screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await act(() => {
      setOnline(true);
    });
  });

  it("renders empty state", async () => {
    mockUseChecksList.mockReturnValue({ ...BASE_MOCK, ...page([]) });

    await render(<CheckHistoryScreen />);

    expect(screen.getByTestId("check-history-empty")).toHaveTextContent(strings.check.history.empty, {
      exact: false,
    });
    expect(screen.getByTestId("check-history-empty")).toHaveTextContent(strings.check.history.emptyBody, {
      exact: false,
    });
    expect(screen.queryByTestId("check-history-row-c1")).toBeNull();
  });

  it("renders a row per item with the right chip", async () => {
    mockUseChecksList.mockReturnValue({ ...BASE_MOCK, ...page([MONITOR_ITEM, RED_FLAG_ITEM]) });

    await render(<CheckHistoryScreen />);

    expect(screen.getByTestId("check-history-row-c1")).toBeTruthy();
    expect(screen.getByTestId("check-history-row-c2")).toBeTruthy();
    expect(screen.getByTestId("check-history-chip-c1")).toHaveTextContent(
      strings.check.result.tierLabel.MONITOR,
    );
    expect(screen.getByTestId("check-history-chip-c2")).toHaveTextContent(
      strings.check.result.tierLabel.EMERGENCY_NOW,
    );
  });

  it("load-more calls fetchNextPage", async () => {
    const fetchNextPage = jest.fn();
    mockUseChecksList.mockReturnValue({
      ...BASE_MOCK,
      ...page([MONITOR_ITEM]),
      hasNextPage: true,
      fetchNextPage,
    });

    await render(<CheckHistoryScreen />);

    const loadMore = screen.getByTestId("check-history-load-more");
    expect(loadMore).toHaveTextContent(strings.check.history.loadMore);
    expect(loadMore.props.className).not.toContain("bg-brand-700");
    await fireEvent.press(loadMore);

    expect(fetchNextPage).toHaveBeenCalled();
  });

  it("shows the loading-more label while fetching the next page", async () => {
    mockUseChecksList.mockReturnValue({
      ...BASE_MOCK,
      ...page([MONITOR_ITEM]),
      hasNextPage: true,
      isFetchingNextPage: true,
    });

    await render(<CheckHistoryScreen />);

    expect(screen.getByTestId("check-history-load-more")).toHaveTextContent(strings.check.history.loadingMore);
  });

  it("shows the loading state", async () => {
    mockUseChecksList.mockReturnValue({ ...BASE_MOCK, data: undefined, isLoading: true });

    await render(<CheckHistoryScreen />);

    expect(screen.getByTestId("check-history-loading")).toBeTruthy();
  });

  it("shows the error state and retry calls refetch", async () => {
    const refetch = jest.fn();
    mockUseChecksList.mockReturnValue({ ...BASE_MOCK, data: undefined, isError: true, refetch });

    await render(<CheckHistoryScreen />);

    expect(screen.getByTestId("check-history-error")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("check-history-retry"));

    expect(refetch).toHaveBeenCalled();
  });

  it("renders rows from both pages of a two-page result set (pages.flatMap appends)", async () => {
    const pageTwoItem = { ...MONITOR_ITEM, id: "c3" } as unknown as CheckResponse;
    mockUseChecksList.mockReturnValue({
      ...BASE_MOCK,
      data: {
        pages: [
          { items: [MONITOR_ITEM], nextCursor: "c1" },
          { items: [pageTwoItem], nextCursor: null },
        ],
        pageParams: [undefined, "c1"],
      },
    });

    await render(<CheckHistoryScreen />);

    expect(screen.getByTestId("check-history-row-c1")).toBeTruthy();
    expect(screen.getByTestId("check-history-row-c3")).toBeTruthy();
  });

  it("row press pushes the result route", async () => {
    mockUseChecksList.mockReturnValue({ ...BASE_MOCK, ...page([MONITOR_ITEM]) });

    await render(<CheckHistoryScreen />);
    await fireEvent.press(screen.getByTestId("check-history-row-c1"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/check/result/[checkId]",
      params: { checkId: "c1" },
    });
  });

  it("shows a non-blocking offline banner while offline, list still renders", async () => {
    mockUseChecksList.mockReturnValue({ ...BASE_MOCK, ...page([MONITOR_ITEM]) });
    setOnline(false);

    await render(<CheckHistoryScreen />);

    expect(screen.getByTestId("check-history-offline-banner")).toBeTruthy();
    expect(screen.getByTestId("check-history-row-c1")).toBeTruthy();
  });
});
