import { setOnline } from "@pawcareright/api-client";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import IntakeScreen from "../app/check/[category]";

// Route screen tests (T045 plan "Route screen tests"). `expo-router` is
// mocked like the T044 test; offline is driven by the REAL shared store
// (`setOnline`), reset to online in `afterEach`. RNTL v14 — every render
// awaited. T047 wires the real `useCheckSubmission` into this screen, which
// calls `useCreateCheck` (checks-api) — a real TanStack `useMutation`/
// `useQueryClient` that requires a `QueryClientProvider` ancestor none of
// these render-only tests exercise (they never submit). `checks-api` is
// mocked here (same idiom as `add-pet-done.test.tsx` mocking `pets-api`) so
// this pre-existing render/offline/back-button coverage stays a lightweight,
// provider-free test.
const mockBack = jest.fn();
let mockParams: { category?: string; petId?: string } = { category: "vomiting", petId: "pet1" };

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock("../src/api/checks-api", () => ({
  useCreateCheck: () => ({ mutateAsync: jest.fn() }),
}));

describe("intake route screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { category: "vomiting", petId: "pet1" };
  });

  afterEach(async () => {
    await act(() => {
      setOnline(true);
    });
  });

  it("renders the IntakeForm for a valid category", async () => {
    await render(<IntakeScreen />);

    expect(screen.getByTestId("intake-form")).toBeTruthy();
    expect(screen.getByTestId("intake-question-prompt")).toBeTruthy();
  });

  it("renders a graceful error for an invalid category, without crashing", async () => {
    mockParams = { category: "nope", petId: "pet1" };

    await render(<IntakeScreen />);

    expect(screen.getByTestId("intake-invalid-category")).toBeTruthy();
    expect(screen.queryByTestId("intake-form")).toBeNull();
  });

  it("shows the offline banner while the form still renders", async () => {
    setOnline(false);

    await render(<IntakeScreen />);

    expect(screen.getByTestId("intake-offline-banner")).toBeTruthy();
    expect(screen.getByTestId("intake-form")).toBeTruthy();
  });

  it("wires onExit to router.back", async () => {
    await render(<IntakeScreen />);

    await fireEvent.press(screen.getByTestId("intake-back"));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
