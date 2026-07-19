import { setOnline } from "@pawcareright/api-client";
import { petIdSchema, type Pet } from "@pawcareright/types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import ActivityScreen from "../app/activity/[petId]";
import { useAddActivity, useHealthTimeline } from "../src/api/health-logs-api";
import { usePet } from "../src/api/pets-api";
import { useActivityRecentsStore } from "../src/health-logs/activity-recents-store";
import { strings } from "../src/strings";

/**
 * The tap-first activity logger screen (founder-directed activity-log
 * task). Mirrors `note-screen.test.tsx`'s mocking pattern: `expo-router`/
 * `pets-api`/`health-logs-api` hooks mocked; offline driven by the REAL
 * shared store. `useActivityRecentsStore` is the REAL store (a plain
 * zustand+MMKV-mock store, mirrors `weight-unit-store.test.ts`'s
 * precedent) so its persistence/dedupe behavior is exercised end to end.
 *
 * The "save in <=2 taps: chip then Save" test below is the executor's
 * non-vacuity mutation-proof #3 target.
 */
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ petId: "pet1" }),
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../src/api/pets-api", () => ({
  usePet: jest.fn(),
}));

jest.mock("../src/api/health-logs-api", () => ({
  useAddActivity: jest.fn(),
  useHealthTimeline: jest.fn(),
}));

const mockedUsePet = usePet as unknown as jest.Mock;
const mockedUseAddActivity = useAddActivity as unknown as jest.Mock;
const mockedUseHealthTimeline = useHealthTimeline as unknown as jest.Mock;

const mockRefetch = jest.fn();
const mockMutate = jest.fn();
const mockPush = jest.fn();

const FIXTURE_PET: Pet = {
  id: petIdSchema.parse("11111111-1111-4111-8111-111111111111"),
  householdId: "22222222-2222-2222-2222-222222222222",
  species: "DOG",
  sex: "MALE",
  name: "Rex",
  neutered: true,
  breedSlug: "labrador-retriever",
  birthDate: "2022-01-15T00:00:00.000Z",
  ageEstimateMonths: null,
  weightGrams: 25000,
  photoKey: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

describe("activity screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAddActivity.mockReturnValue({ mutate: mockMutate, isPending: false });
    mockedUseHealthTimeline.mockReturnValue({
      data: { pages: [{ items: [], nextCursor: null }] },
      isLoading: false,
    });
    useActivityRecentsStore.setState({ byPet: {} });
  });

  afterEach(async () => {
    await act(() => {
      setOnline(true);
    });
    jest.useRealTimers();
  });

  it("loading: shows activity-screen-loading", async () => {
    mockedUsePet.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: mockRefetch });

    await render(<ActivityScreen />);

    expect(screen.getByTestId("activity-screen-loading")).toBeTruthy();
  });

  it("error: shows activity-screen-error; retry calls refetch once", async () => {
    mockedUsePet.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: mockRefetch });

    await render(<ActivityScreen />);

    expect(screen.getByTestId("activity-screen-error")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("activity-screen-retry"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("offline (no cache): shows activity-screen-offline; retry calls refetch", async () => {
    mockedUsePet.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: mockRefetch });
    setOnline(false);

    await render(<ActivityScreen />);

    expect(screen.getByTestId("activity-screen-offline")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("activity-screen-retry"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("empty/not-found: shows activity-screen-empty", async () => {
    mockedUsePet.mockReturnValue({ data: null, isLoading: false, isError: false, refetch: mockRefetch });

    await render(<ActivityScreen />);

    expect(screen.getByTestId("activity-screen-empty")).toBeTruthy();
  });

  it("loaded (offline, cached): shows the offline banner over content", async () => {
    mockedUsePet.mockReturnValue({ data: FIXTURE_PET, isLoading: false, isError: false, refetch: mockRefetch });
    setOnline(false);

    await render(<ActivityScreen />);

    expect(screen.getByTestId("activity-screen-offline-banner")).toBeTruthy();
  });

  // FIDELITY-1: the Today intake strip renders at the top of the logger,
  // never blocking the ≤2-tap chip flow below it.
  it("renders the activity-today-strip above the recents row / chip grid", async () => {
    mockedUsePet.mockReturnValue({ data: FIXTURE_PET, isLoading: false, isError: false, refetch: mockRefetch });

    await render(<ActivityScreen />);

    expect(screen.getByTestId("activity-today-strip")).toBeTruthy();
    expect(screen.getByTestId("activity-chip-WALK")).toBeTruthy();
  });

  it("save in <=2 taps: tap a chip (tap 1) then tap Save (tap 2) with zero further input", async () => {
    mockMutate.mockImplementation((_vars, options: { onSuccess?: () => void }) => {
      options.onSuccess?.();
    });
    mockedUsePet.mockReturnValue({ data: FIXTURE_PET, isLoading: false, isError: false, refetch: mockRefetch });

    await render(<ActivityScreen />);

    await fireEvent.press(screen.getByTestId("activity-chip-WALK"));
    await fireEvent.press(screen.getByTestId("activity-sheet-save"));

    expect(mockMutate).toHaveBeenCalledWith(
      { activityType: "WALK", quantity: 20, unit: "min" },
      expect.anything(),
    );

    // PAWSAATHI-2: the frozen undo testIDs are still present after a save
    // (undo banner only mounts via the recents path, so it's absent here --
    // this asserts the sheet's own testIDs, not the undo machinery itself).
    expect(screen.queryByTestId("activity-sheet")).toBeNull();
  });

  it("PAWSAATHI-2: root + header carry dark variants", async () => {
    mockedUsePet.mockReturnValue({ data: FIXTURE_PET, isLoading: false, isError: false, refetch: mockRefetch });

    const view = await render(<ActivityScreen />);

    expect(view.toJSON()?.props.className).toContain("dark:bg-surface-page-dark");
    expect(screen.getByText(strings.activity.title).props.className).toContain("dark:text-ink-dark");
  });

  it("a successful save records a recent for that pet and closes the sheet", async () => {
    mockMutate.mockImplementation((_vars, options: { onSuccess?: () => void }) => {
      options.onSuccess?.();
    });
    mockedUsePet.mockReturnValue({ data: FIXTURE_PET, isLoading: false, isError: false, refetch: mockRefetch });

    await render(<ActivityScreen />);

    await fireEvent.press(screen.getByTestId("activity-chip-FOOD"));
    await fireEvent.press(screen.getByTestId("activity-sheet-save"));

    expect(screen.queryByTestId("activity-sheet")).toBeNull();
    expect(useActivityRecentsStore.getState().byPet.pet1).toEqual([
      { activityType: "FOOD", quantity: 1, unit: "meals" },
    ]);
  });

  // CRAFT-1 plan §7.5 Peak-End (R4): the sheet-save confirmation uses its OWN
  // state/timer, independent of the recents deferred-undo machinery below.
  it("a sheet Save shows activity-saved-confirmation, which then auto-clears", async () => {
    jest.useFakeTimers();
    mockMutate.mockImplementation((_vars, options: { onSuccess?: () => void }) => {
      options.onSuccess?.();
    });
    mockedUsePet.mockReturnValue({ data: FIXTURE_PET, isLoading: false, isError: false, refetch: mockRefetch });

    await render(<ActivityScreen />);

    await fireEvent.press(screen.getByTestId("activity-chip-WALK"));
    await fireEvent.press(screen.getByTestId("activity-sheet-save"));

    expect(screen.getByTestId("activity-saved-confirmation")).toHaveTextContent("Logged: Walked · 20 min", {
      exact: false,
    });

    await act(async () => {
      jest.advanceTimersByTime(2500);
    });

    expect(screen.queryByTestId("activity-saved-confirmation")).toBeNull();
  });

  it("a recent chip pre-fills the sheet's smart default for that type", async () => {
    useActivityRecentsStore.setState({ byPet: { pet1: [{ activityType: "FOOD", quantity: 3, unit: "meals" }] } });
    mockedUsePet.mockReturnValue({ data: FIXTURE_PET, isLoading: false, isError: false, refetch: mockRefetch });

    await render(<ActivityScreen />);

    await fireEvent.press(screen.getByTestId("activity-chip-FOOD"));

    expect(screen.getByTestId("activity-quantity-value")).toHaveTextContent("3");
  });

  it("the written-note link navigates to /note/[petId] and closes the sheet", async () => {
    mockedUsePet.mockReturnValue({ data: FIXTURE_PET, isLoading: false, isError: false, refetch: mockRefetch });

    await render(<ActivityScreen />);

    await fireEvent.press(screen.getByTestId("activity-chip-FOOD"));
    await fireEvent.press(screen.getByTestId("activity-sheet-written-note"));

    expect(mockPush).toHaveBeenCalledWith({ pathname: "/note/[petId]", params: { petId: "pet1" } });
    expect(screen.queryByTestId("activity-sheet")).toBeNull();
  });

  describe("recents row: 1-tap repeat with a delayed-save undo (no DELETE /logs endpoint -- see report)", () => {
    beforeEach(() => {
      useActivityRecentsStore.setState({
        byPet: { pet1: [{ activityType: "FOOD", quantity: 2, unit: "meals" }] },
      });
      mockedUsePet.mockReturnValue({ data: FIXTURE_PET, isLoading: false, isError: false, refetch: mockRefetch });
    });

    it("tapping a recent shows the undo banner immediately, WITHOUT posting the mutation yet", async () => {
      await render(<ActivityScreen />);

      await fireEvent.press(screen.getByTestId("activity-recent-chip-0"));

      expect(screen.getByTestId("activity-undo-banner")).toHaveTextContent("Logged: Fed · 2 meals", { exact: false });
      expect(mockMutate).not.toHaveBeenCalled();
    });

    it("after the 6s undo window elapses without Undo, the mutation posts and the banner clears", async () => {
      jest.useFakeTimers();
      await render(<ActivityScreen />);

      await fireEvent.press(screen.getByTestId("activity-recent-chip-0"));
      await act(async () => {
        jest.advanceTimersByTime(6000);
      });

      expect(mockMutate).toHaveBeenCalledWith(
        { activityType: "FOOD", quantity: 2, unit: "meals" },
        expect.anything(),
      );
      expect(screen.queryByTestId("activity-undo-banner")).toBeNull();
    });

    it("a second tap inside the window FLUSHES the first entry's save instead of dropping it (checker B1)", async () => {
      jest.useFakeTimers();
      await render(<ActivityScreen />);

      await fireEvent.press(screen.getByTestId("activity-recent-chip-0"));
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      await fireEvent.press(screen.getByTestId("activity-recent-chip-0"));

      // First tap's entry must POST immediately at the second tap...
      expect(mockMutate).toHaveBeenCalledTimes(1);
      expect(mockMutate).toHaveBeenCalledWith(
        { activityType: "FOOD", quantity: 2, unit: "meals" },
        expect.anything(),
      );

      // ...and the second tap's entry posts when ITS window elapses: 2 logs, none lost.
      await act(async () => {
        jest.advanceTimersByTime(6000);
      });
      expect(mockMutate).toHaveBeenCalledTimes(2);
    });

    it("unmounting inside the window flushes the pending save -- navigation cannot lose a confirmed log", async () => {
      jest.useFakeTimers();
      const view = await render(<ActivityScreen />);

      await fireEvent.press(screen.getByTestId("activity-recent-chip-0"));
      expect(mockMutate).not.toHaveBeenCalled();

      await act(async () => {
        view.unmount();
      });

      expect(mockMutate).toHaveBeenCalledWith(
        { activityType: "FOOD", quantity: 2, unit: "meals" },
        expect.anything(),
      );
    });

    it("pressing Undo within the window cancels the save entirely -- the mutation never fires", async () => {
      jest.useFakeTimers();
      await render(<ActivityScreen />);

      await fireEvent.press(screen.getByTestId("activity-recent-chip-0"));
      await fireEvent.press(screen.getByTestId("activity-undo-button"));

      expect(screen.queryByTestId("activity-undo-banner")).toBeNull();

      await act(async () => {
        jest.advanceTimersByTime(6000);
      });

      expect(mockMutate).not.toHaveBeenCalled();
    });
  });
});
