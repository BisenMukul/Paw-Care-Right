import { render, screen } from "@testing-library/react-native";
import * as ReactNative from "react-native";

import { useHealthTimeline } from "../src/api/health-logs-api";
import { TodayActivityStrip } from "../src/components/today-activity-strip";
import { strings } from "../src/strings";

jest.mock("../src/api/health-logs-api", () => ({
  ...jest.requireActual("../src/api/health-logs-api"),
  useHealthTimeline: jest.fn(),
}));

const mockedUseHealthTimeline = useHealthTimeline as unknown as jest.Mock;

function page(items: Array<{ kind: string; occurredAt: string; value: Record<string, unknown> }>) {
  return { data: { pages: [{ items, nextCursor: null }] }, isLoading: false };
}

describe("TodayActivityStrip", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("loading: shows a benign placeholder", async () => {
    mockedUseHealthTimeline.mockReturnValue({ data: undefined, isLoading: true });

    await render(<TodayActivityStrip petId="pet1" />);

    expect(screen.getByTestId("activity-today-strip")).toBeTruthy();
    expect(screen.getByTestId("activity-today-strip-loading")).toBeTruthy();
  });

  it("empty page: shows today.empty copy", async () => {
    mockedUseHealthTimeline.mockReturnValue(page([]));

    await render(<TodayActivityStrip petId="pet1" />);

    expect(screen.getByTestId("activity-today-strip-empty")).toHaveTextContent(strings.activity.today.empty);
  });

  it("counts render from a mocked page (today's FOOD + WALK)", async () => {
    const now = new Date();
    const todayIso = now.toISOString();
    mockedUseHealthTimeline.mockReturnValue(
      page([
        { kind: "ACTIVITY", occurredAt: todayIso, value: { activityType: "FOOD" } },
        { kind: "ACTIVITY", occurredAt: todayIso, value: { activityType: "WALK" } },
      ]),
    );

    await render(<TodayActivityStrip petId="pet1" />);

    expect(screen.getByText(strings.activity.today.meals(1))).toBeTruthy();
    expect(screen.getByText(strings.activity.today.walks(1))).toBeTruthy();
    expect(screen.queryByTestId("activity-today-strip-empty")).toBeNull();
  });

  it("renders without error in both color schemes", async () => {
    mockedUseHealthTimeline.mockReturnValue(page([]));

    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");
    await render(<TodayActivityStrip petId="pet1" />);
    expect(screen.getByTestId("activity-today-strip")).toBeTruthy();

    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    await render(<TodayActivityStrip petId="pet1" />);
    expect(screen.getAllByTestId("activity-today-strip").length).toBeGreaterThan(0);
  });
});
