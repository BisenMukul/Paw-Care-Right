import { setOnline } from "@bombaypetcompany/api-client";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, canGoBack: () => false, replace: jest.fn() }),
}));

const mockMutate = jest.fn();
const mockRequestScreenshotUploadUrl = jest.fn();
jest.mock("../src/api/feedback-api", () => ({
  useSubmitFeedback: jest.fn(() => ({ mutate: mockMutate, isPending: false, isError: false })),
  requestScreenshotUploadUrl: () => mockRequestScreenshotUploadUrl(),
}));

const mockAddFeedbackBreadcrumb = jest.fn();
const mockGetLastSentryEventId = jest.fn();
jest.mock("../src/observability/sentry", () => ({
  addFeedbackBreadcrumb: (...args: unknown[]) => mockAddFeedbackBreadcrumb(...args),
  getLastSentryEventId: () => mockGetLastSentryEventId(),
}));

const mockGetLogEntries = jest.fn();
jest.mock("../src/observability/log-buffer", () => ({
  getLogEntries: () => mockGetLogEntries(),
}));

// `globalThis.fetch` (not `global`, which has no ambient type in this
// workspace -- mirrors `analytics-consent.test.ts`/`token-storage.test.ts`).
globalThis.fetch = jest.fn().mockImplementation((input: string) => {
  if (typeof input === "string" && input.startsWith("file://")) {
    return Promise.resolve({ blob: () => Promise.resolve({ size: 10 }) });
  }
  return Promise.resolve({ ok: true });
}) as unknown as typeof fetch;

import FeedbackScreen from "../app/feedback";
import { strings } from "../src/strings";

/**
 * T104 plan AC map: consent-gated `logs` inclusion (AC2 client half) + the
 * D5 Sentry event-id/breadcrumb wiring, plus the screen's mandated
 * loading/error/empty/offline states. Every `fireEvent` call is awaited
 * (repo idiom -- see `privacy-screen.test.tsx`/`note-screen.test.tsx`) so
 * the underlying `act()` flush completes before the next interaction.
 */
describe("FeedbackScreen (T104)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLogEntries.mockReturnValue([]);
    mockGetLastSentryEventId.mockReturnValue(undefined);
    mockRequestScreenshotUploadUrl.mockResolvedValue({ uploadUrl: "https://signed.example/put", key: "feedback/u1/x.jpg" });
  });

  afterEach(async () => {
    await act(async () => {
      setOnline(true);
    });
  });

  it("the consent toggle is off by default", async () => {
    await render(<FeedbackScreen />);

    const toggle = screen.getByTestId("feedback-logs-consent");
    expect(toggle.props.value).toBe(false);
  });

  it("an empty message disables the submit button", async () => {
    await render(<FeedbackScreen />);

    const submit = screen.getByTestId("feedback-submit");
    expect(submit.props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(submit);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("offline disables the submit button", async () => {
    await act(async () => {
      setOnline(false);
    });

    await render(<FeedbackScreen />);

    await fireEvent.changeText(screen.getByTestId("feedback-message"), "It crashed.");
    expect(screen.getByTestId("feedback-offline")).toBeTruthy();
    expect(screen.getByTestId("feedback-submit").props.accessibilityState.disabled).toBe(true);
  });

  it("omits logs from the submitted payload while the consent toggle is off", async () => {
    mockGetLogEntries.mockReturnValue([{ at: "2024-01-01T00:00:00.000Z", level: "error", code: "captured_error" }]);

    await render(<FeedbackScreen />);

    await fireEvent.changeText(screen.getByTestId("feedback-message"), "It crashed.");
    await fireEvent.press(screen.getByTestId("feedback-submit"));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledTimes(1);
    });
    const [payload] = mockMutate.mock.calls[0] as [Record<string, unknown>];
    expect(payload.attachLogs).toBe(false);
    expect(payload.logs).toBeUndefined();
  });

  it("includes logs only after the consent toggle is switched on", async () => {
    const entries = [{ at: "2024-01-01T00:00:00.000Z", level: "error", code: "captured_error" }];
    mockGetLogEntries.mockReturnValue(entries);

    await render(<FeedbackScreen />);

    await fireEvent.changeText(screen.getByTestId("feedback-message"), "It crashed.");
    await fireEvent(screen.getByTestId("feedback-logs-consent"), "valueChange", true);
    await fireEvent.press(screen.getByTestId("feedback-submit"));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledTimes(1);
    });
    const [payload] = mockMutate.mock.calls[0] as [Record<string, unknown>];
    expect(payload.attachLogs).toBe(true);
    expect(payload.logs).toEqual(entries);
  });

  it("submits the current Sentry event id and adds a content-free feedback breadcrumb", async () => {
    mockGetLastSentryEventId.mockReturnValue("a".repeat(32));

    await render(<FeedbackScreen />);

    await fireEvent.changeText(screen.getByTestId("feedback-message"), "It crashed.");
    await fireEvent.press(screen.getByTestId("feedback-submit"));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledTimes(1);
    });

    expect(mockAddFeedbackBreadcrumb).toHaveBeenCalledWith("BUG");

    const [payload] = mockMutate.mock.calls[0] as [Record<string, unknown>];
    expect(payload.sentryEventId).toBe("a".repeat(32));
    expect(typeof payload.sentryRelease).toBe("string");
  });

  it("selecting a category chip changes the category submitted", async () => {
    await render(<FeedbackScreen />);

    await fireEvent.changeText(screen.getByTestId("feedback-message"), "A neat idea.");
    await fireEvent.press(screen.getByTestId("feedback-category-IDEA"));
    await fireEvent.press(screen.getByTestId("feedback-submit"));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledTimes(1);
    });
    const [payload] = mockMutate.mock.calls[0] as [Record<string, unknown>];
    expect(payload.category).toBe("IDEA");
    expect(mockAddFeedbackBreadcrumb).toHaveBeenCalledWith("IDEA");
  });

  it("attaching a screenshot presigns, uploads, and includes the key on submit", async () => {
    await render(<FeedbackScreen />);

    await fireEvent.press(screen.getByTestId("feedback-attach-image"));

    await waitFor(() => {
      expect(screen.getByText(strings.feedback.imageAttached)).toBeTruthy();
    });
    expect(mockRequestScreenshotUploadUrl).toHaveBeenCalledTimes(1);

    await fireEvent.changeText(screen.getByTestId("feedback-message"), "See attached.");
    await fireEvent.press(screen.getByTestId("feedback-submit"));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledTimes(1);
    });
    const [payload] = mockMutate.mock.calls[0] as [Record<string, unknown>];
    expect(payload.screenshotKey).toBe("feedback/u1/x.jpg");
  });

  it("shows the generic error notice when the mutation fails", async () => {
    const { useSubmitFeedback } = jest.requireMock("../src/api/feedback-api") as {
      useSubmitFeedback: jest.Mock;
    };
    useSubmitFeedback.mockReturnValue({ mutate: mockMutate, isPending: false, isError: true });

    await render(<FeedbackScreen />);

    expect(screen.getByTestId("feedback-error")).toBeTruthy();
  });
});
