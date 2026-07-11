import { ApiError } from "@pawcareright/api-client";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import JoinScreen from "../app/join/[code]";
import { useAcceptInvite } from "../src/api/households-api";
import { strings } from "../src/strings";

// The deep-link-route AC (T026 plan): the route extracts the `code` param
// from the URL and fires the accept mutation with exactly it; success
// navigates to the signed-in tabs; the uniform 404 (invalid/expired/used)
// and the distinct 409 (pets-present conflict) render different copy.
// `expo-router` and `households-api` are mocked; RNTL v14 — awaited render.
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({ code: "ABCD2345" }),
}));

jest.mock("../src/api/households-api", () => ({
  useAcceptInvite: jest.fn(),
}));

const mockedUseAcceptInvite = useAcceptInvite as unknown as jest.Mock;
const mockMutateAsync = jest.fn();

describe("join/[code] route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAcceptInvite.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });
  });

  it("[AC] parses the code param and fires accept with it; success navigates to tabs", async () => {
    mockMutateAsync.mockResolvedValue({ householdId: "household-1", name: "The Smiths" });

    await render(<JoinScreen />);
    await fireEvent.press(screen.getByTestId("join-accept"));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    });
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledWith({ code: "ABCD2345" });
  });

  it("[AC] a 404 (invalid/expired/used, uniform) renders the invalid-link error and does not navigate", async () => {
    mockMutateAsync.mockRejectedValue(
      new ApiError({ code: "NOT_FOUND", message: "Not Found", httpStatus: 404, requestId: null }),
    );

    await render(<JoinScreen />);
    await fireEvent.press(screen.getByTestId("join-accept"));

    await waitFor(() => {
      expect(screen.getByTestId("join-error")).toBeTruthy();
    });
    expect(screen.getByText(strings.join.invalidError)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("[AC] a 409 (pets-present conflict) renders the distinct conflict message", async () => {
    mockMutateAsync.mockRejectedValue(
      new ApiError({ code: "CONFLICT", message: "Conflict", httpStatus: 409, requestId: null }),
    );

    await render(<JoinScreen />);
    await fireEvent.press(screen.getByTestId("join-accept"));

    await waitFor(() => {
      expect(screen.getByText(strings.join.petsPresentError)).toBeTruthy();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
