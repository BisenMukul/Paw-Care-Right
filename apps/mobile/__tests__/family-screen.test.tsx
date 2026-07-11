import type { HouseholdMe } from "@pawcareright/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Share } from "react-native";

import FamilyScreen from "../app/family";
import { useCreateInvite, useHouseholdMe } from "../src/api/households-api";
import { useAuthStore } from "../src/auth/auth-store";
import { strings } from "../src/strings";

// Members render, OWNER-only invite gating, and the invite → share-sheet
// orchestration (T026 plan). `households-api` hooks are mocked; the auth
// store is the REAL store (matches `auth-store.test.ts` precedent) with
// `user` set per-test to drive the owner/member gate. `Share.share` is
// spied so the deep link hand-off can be asserted without a real share
// sheet. RNTL v14 — every render/press is awaited.
jest.mock("../src/api/households-api", () => ({
  useHouseholdMe: jest.fn(),
  useCreateInvite: jest.fn(),
}));

const mockedUseHouseholdMe = useHouseholdMe as unknown as jest.Mock;
const mockedUseCreateInvite = useCreateInvite as unknown as jest.Mock;
const mockRefetch = jest.fn();
const mockMutateAsync = jest.fn();

const HOUSEHOLD: HouseholdMe = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "The Smiths",
  members: [
    { userId: "user-owner", email: "owner@example.com", role: "OWNER" },
    { userId: "user-member", email: "member@example.com", role: "MEMBER" },
  ],
};

function resetAuthUser(id: string, email: string) {
  useAuthStore.setState({ user: { id, email } });
}

describe("family screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
    mockedUseCreateInvite.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });
    resetAuthUser("user-owner", "owner@example.com");
  });

  it("loading: shows family-loading", async () => {
    mockedUseHouseholdMe.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: mockRefetch,
    });

    await render(<FamilyScreen />);

    expect(screen.getByTestId("family-loading")).toBeTruthy();
  });

  it("error: shows family-error; retry calls refetch once", async () => {
    mockedUseHouseholdMe.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    });

    await render(<FamilyScreen />);

    expect(screen.getByTestId("family-error")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("family-retry"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("[AC] members render with role badges; OWNER caller sees the invite button", async () => {
    mockedUseHouseholdMe.mockReturnValue({
      data: HOUSEHOLD,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    await render(<FamilyScreen />);

    expect(screen.getByText("owner@example.com")).toBeTruthy();
    expect(screen.getByText("member@example.com")).toBeTruthy();
    expect(screen.getByTestId("family-member-role-user-owner")).toHaveTextContent(
      strings.family.owner,
    );
    expect(screen.getByTestId("family-member-role-user-member")).toHaveTextContent(
      strings.family.member,
    );
    expect(screen.getByTestId("family-invite-button")).toBeTruthy();
  });

  it("[AC] MEMBER-role caller does NOT see the invite button", async () => {
    resetAuthUser("user-member", "member@example.com");
    mockedUseHouseholdMe.mockReturnValue({
      data: HOUSEHOLD,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    await render(<FamilyScreen />);

    expect(screen.queryByTestId("family-invite-button")).toBeNull();
  });

  it("[AC] invite button creates an invite and shares the returned deep link", async () => {
    mockedUseHouseholdMe.mockReturnValue({
      data: HOUSEHOLD,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });
    mockMutateAsync.mockResolvedValue({
      code: "ABCD2345",
      deepLink: "pawcareright://join/ABCD2345",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });

    await render(<FamilyScreen />);
    await fireEvent.press(screen.getByTestId("family-invite-button"));

    await waitFor(() => {
      expect(Share.share).toHaveBeenCalledWith({ message: "pawcareright://join/ABCD2345" });
    });
    expect(screen.queryByTestId("family-invite-error")).toBeNull();
  });

  it("shows an invite error when create-invite fails, without calling Share", async () => {
    mockedUseHouseholdMe.mockReturnValue({
      data: HOUSEHOLD,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });
    mockMutateAsync.mockRejectedValue(new Error("network down"));

    await render(<FamilyScreen />);
    await fireEvent.press(screen.getByTestId("family-invite-button"));

    await waitFor(() => {
      expect(screen.getByTestId("family-invite-error")).toBeTruthy();
    });
    expect(Share.share).not.toHaveBeenCalled();
  });
});
