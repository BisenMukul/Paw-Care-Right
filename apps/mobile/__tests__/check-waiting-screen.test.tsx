import type { CheckResponse } from "@pawcareright/types";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";

import CheckWaitingScreen from "../app/check/waiting/[checkId]";
import { strings } from "../src/strings";

// T047 plan AC1 "polling stops on DONE/FALLBACK": with `useCheck` mocked to
// return a terminal status, the screen navigates to the T048 result route
// (D6, both DONE and FALLBACK); with a non-terminal status it renders the
// calm waiting copy and does NOT navigate. Cancel replaces to pet home
// (D7 — cancel-safe, no abort).
const mockReplace = jest.fn();
let mockParams: { checkId?: string; petId?: string } = { checkId: "check1", petId: "pet1" };

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
}));

const mockUseCheck = jest.fn();

jest.mock("../src/api/checks-api", () => ({
  useCheck: (checkId: string) => mockUseCheck(checkId),
}));

function checkWithStatus(status: CheckResponse["status"]): CheckResponse {
  return { id: "check1", status, category: "vomiting", createdAt: "2024-01-01T00:00:00.000Z" };
}

describe("check waiting screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { checkId: "check1", petId: "pet1" };
  });

  it("renders the calm waiting copy and does not navigate while RUNNING", async () => {
    mockUseCheck.mockReturnValue({ data: checkWithStatus("RUNNING") });

    await render(<CheckWaitingScreen />);

    expect(screen.getByText(strings.check.waiting.title)).toBeTruthy();
    expect(screen.getByText(strings.check.waiting.body)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("navigates to the result route when the status is DONE", async () => {
    mockUseCheck.mockReturnValue({ data: checkWithStatus("DONE") });

    await render(<CheckWaitingScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: "/check/result/[checkId]",
        params: { checkId: "check1" },
      });
    });
  });

  it("navigates to the result route when the status is FALLBACK", async () => {
    mockUseCheck.mockReturnValue({ data: checkWithStatus("FALLBACK") });

    await render(<CheckWaitingScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: "/check/result/[checkId]",
        params: { checkId: "check1" },
      });
    });
  });

  it("does not navigate while QUEUED", async () => {
    mockUseCheck.mockReturnValue({ data: checkWithStatus("QUEUED") });

    await render(<CheckWaitingScreen />);

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("cancel navigates to pet home without calling any abort", async () => {
    mockUseCheck.mockReturnValue({ data: checkWithStatus("RUNNING") });

    await render(<CheckWaitingScreen />);
    await fireEvent.press(screen.getByTestId("check-waiting-cancel"));

    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/pets/[id]", params: { id: "pet1" } });
  });
});
