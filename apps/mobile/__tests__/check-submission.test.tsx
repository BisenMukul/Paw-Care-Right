import { ApiError, setOnline } from "@pawcareright/api-client";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import IntakeScreen from "../app/check/[category]";
import { strings } from "../src/strings";

// T047 plan AC map (AC2 red-flag bypasses polling, AC3 offline blocked +
// retry, + supporting Definition-of-Done tests) driven through the real
// `app/check/[category]` screen + the real `useCheckSubmission` hook.
// `useCreateCheck` (checks-api) is mocked to a stand-in `mutateAsync`;
// `expo-router` is mocked; `expo-crypto`'s `randomUUID` is mocked to fixed
// values so the Idempotency-Key reuse-across-retries assertion is exact;
// offline is driven via the REAL shared `setOnline` store, reset to online
// in `afterEach` (matches the `intake-screen.test.tsx` idiom).
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: { category?: string; petId?: string } = { category: "other", petId: "pet1" };

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));

const mockMutateAsync = jest.fn();

jest.mock("../src/api/checks-api", () => ({
  useCreateCheck: () => ({ mutateAsync: mockMutateAsync }),
}));

let mockUuidCounter = 0;
jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => `uuid-${++mockUuidCounter}`),
}));

/** Fills the real "other" category's 2-question form and presses submit. */
async function fillAndSubmit() {
  await fireEvent.changeText(screen.getByTestId("intake-duration-value-onset"), "2");
  await fireEvent.press(screen.getByTestId("intake-duration-unit-onset-hours"));
  await fireEvent.press(screen.getByTestId("intake-next"));
  await fireEvent.press(screen.getByTestId("intake-scale-severity-3"));
  await fireEvent.press(screen.getByTestId("intake-next"));
  await fireEvent.press(screen.getByTestId("intake-next")); // skip free-text
  await fireEvent.press(screen.getByTestId("intake-submit"));
}

describe("check submission flow (app/check/[category])", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUuidCounter = 0;
    mockParams = { category: "other", petId: "pet1" };
  });

  afterEach(async () => {
    await act(() => {
      setOnline(true);
    });
  });

  it("[AC2] red-flag response bypasses polling: replaces to the emergency route, never to waiting", async () => {
    mockMutateAsync.mockResolvedValue({
      id: "check1",
      status: "QUEUED",
      category: "other",
      createdAt: "2024-01-01T00:00:00.000Z",
      redFlag: { ruleId: "rule-1", payloadKey: "payload-1" },
    });

    await render(<IntakeScreen />);
    await fillAndSubmit();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: "/check/emergency/[checkId]",
        params: { checkId: "check1" },
      });
    });
    expect(mockReplace).not.toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/check/waiting/[checkId]" }),
    );
  });

  it("non-red-flag response replaces to the waiting route with {checkId, petId}", async () => {
    mockMutateAsync.mockResolvedValue({
      id: "check2",
      status: "QUEUED",
      category: "other",
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    await render(<IntakeScreen />);
    await fillAndSubmit();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: "/check/waiting/[checkId]",
        params: { checkId: "check2", petId: "pet1" },
      });
    });
  });

  it("[AC3] offline submit is blocked with a retry affordance; mutateAsync is never called", async () => {
    await act(() => {
      setOnline(false);
    });

    await render(<IntakeScreen />);
    await fillAndSubmit();

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText(strings.check.submit.offlineBlocked)).toBeTruthy();
    expect(screen.getByTestId("check-submit-offline-retry")).toBeTruthy();
  });

  it("[AC3] retrying after coming back online submits exactly once and replaces to waiting", async () => {
    await act(() => {
      setOnline(false);
    });
    mockMutateAsync.mockResolvedValue({
      id: "check3",
      status: "QUEUED",
      category: "other",
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    await render(<IntakeScreen />);
    await fillAndSubmit();

    expect(mockMutateAsync).not.toHaveBeenCalled();

    await act(() => {
      setOnline(true);
    });
    await fireEvent.press(screen.getByTestId("check-submit-offline-retry"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: "/check/waiting/[checkId]",
        params: { checkId: "check3", petId: "pet1" },
      });
    });
  });

  it("402 (PAYMENT_REQUIRED) shows the quota copy", async () => {
    mockMutateAsync.mockRejectedValueOnce(
      new ApiError({ code: "PAYMENT_REQUIRED", message: "Quota exceeded.", httpStatus: 402, requestId: null }),
    );

    await render(<IntakeScreen />);
    await fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByText(strings.check.submit.quotaTitle)).toBeTruthy();
    });
    expect(screen.getByText(strings.check.submit.quotaBody)).toBeTruthy();
  });

  it("a generic error shows the error copy with a working retry, reusing the same Idempotency-Key", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("network down"));
    mockMutateAsync.mockResolvedValueOnce({
      id: "check4",
      status: "QUEUED",
      category: "other",
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    await render(<IntakeScreen />);
    await fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByText(strings.check.submit.error)).toBeTruthy();
    });

    await fireEvent.press(screen.getByTestId("check-submit-error-retry"));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: "/check/waiting/[checkId]",
        params: { checkId: "check4", petId: "pet1" },
      });
    });

    expect(mockMutateAsync).toHaveBeenCalledTimes(2);
    const firstKey = (mockMutateAsync.mock.calls[0]?.[0] as { idempotencyKey: string }).idempotencyKey;
    const secondKey = (mockMutateAsync.mock.calls[1]?.[0] as { idempotencyKey: string }).idempotencyKey;
    expect(firstKey).toBe(secondKey);
  });

  it("a brand-new submission (fresh screen mount) gets a fresh Idempotency-Key", async () => {
    mockMutateAsync.mockResolvedValue({
      id: "check5",
      status: "QUEUED",
      category: "other",
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    const { unmount } = await render(<IntakeScreen />);
    await fillAndSubmit();
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
    const firstKey = (mockMutateAsync.mock.calls[0]?.[0] as { idempotencyKey: string }).idempotencyKey;
    await unmount();

    await render(<IntakeScreen />);
    await fillAndSubmit();
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(2));
    const secondKey = (mockMutateAsync.mock.calls[1]?.[0] as { idempotencyKey: string }).idempotencyKey;

    expect(secondKey).not.toBe(firstKey);
  });
});
