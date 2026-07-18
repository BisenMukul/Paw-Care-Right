import { setOnline } from "@pawcareright/api-client";
import { petIdSchema, type Pet } from "@pawcareright/types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import NoteScreen from "../app/note/[petId]";
import { useAddNote } from "../src/api/health-logs-api";
import { usePet } from "../src/api/pets-api";

/**
 * Note screen (T066 plan "Tests to write" — note-screen.test.tsx). Mirrors
 * `weight-screen.test.tsx`'s mocking pattern: `expo-router`/`pets-api`/
 * `health-logs-api` hooks mocked; offline driven by the REAL shared store.
 * `HealthLogPhotoPicker` is mocked to a no-op stub so this test targets the
 * screen/form wiring, not the photo-attach flow (covered by
 * `health-log-photo-picker.test.tsx`).
 */
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ petId: "pet1" }),
  useRouter: () => ({ back: mockBack }),
}));

jest.mock("../src/api/pets-api", () => ({
  usePet: jest.fn(),
}));

jest.mock("../src/api/health-logs-api", () => ({
  useAddNote: jest.fn(),
}));

jest.mock("../src/components/health-log-photo-picker", () => ({
  HealthLogPhotoPicker: () => null,
}));

const mockedUsePet = usePet as unknown as jest.Mock;
const mockedUseAddNote = useAddNote as unknown as jest.Mock;

const mockRefetch = jest.fn();
const mockMutate = jest.fn();
const mockBack = jest.fn();

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

describe("note screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAddNote.mockReturnValue({ mutate: mockMutate, isPending: false });
  });

  afterEach(async () => {
    await act(() => {
      setOnline(true);
    });
    jest.useRealTimers();
  });

  it("loading: shows note-screen-loading", async () => {
    mockedUsePet.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: mockRefetch });

    await render(<NoteScreen />);

    expect(screen.getByTestId("note-screen-loading")).toBeTruthy();
  });

  it("error: shows note-screen-error; retry calls refetch once", async () => {
    mockedUsePet.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: mockRefetch });

    await render(<NoteScreen />);

    expect(screen.getByTestId("note-screen-error")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("note-screen-retry"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("offline (no cache): shows note-screen-offline; retry calls refetch", async () => {
    mockedUsePet.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: mockRefetch });
    setOnline(false);

    await render(<NoteScreen />);

    expect(screen.getByTestId("note-screen-offline")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("note-screen-retry"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("empty/not-found: shows note-screen-empty", async () => {
    mockedUsePet.mockReturnValue({ data: null, isLoading: false, isError: false, refetch: mockRefetch });

    await render(<NoteScreen />);

    expect(screen.getByTestId("note-screen-empty")).toBeTruthy();
  });

  it("loaded (offline, cached): shows the offline banner over content", async () => {
    mockedUsePet.mockReturnValue({ data: FIXTURE_PET, isLoading: false, isError: false, refetch: mockRefetch });
    setOnline(false);

    await render(<NoteScreen />);

    expect(screen.getByTestId("note-screen-offline-banner")).toBeTruthy();
  });

  // CRAFT-1 plan §7.4: the relocated save button is a descendant of the
  // scaffold's bottom-pinned footer region.
  it("the save button is bottom-pinned inside the screen-scaffold footer", async () => {
    mockedUsePet.mockReturnValue({ data: FIXTURE_PET, isLoading: false, isError: false, refetch: mockRefetch });

    await render(<NoteScreen />);

    const footer = screen.getByTestId("screen-scaffold-footer");
    const button = screen.getByTestId("add-note-save");
    expect(footer).toContainElement(button);
  });

  // CRAFT-1 plan §7.5 Peak-End (R1): the mutation fires and completes
  // un-delayed; ONLY `router.back()` is deferred by `CONFIRM_MS`, so the
  // "called exactly once" assertion below is preserved, not weakened --
  // fake timers must be advanced to observe it.
  it("a valid save calls the mutation immediately, shows the save confirmation, then defers router.back()", async () => {
    jest.useFakeTimers();
    mockedUsePet.mockReturnValue({ data: FIXTURE_PET, isLoading: false, isError: false, refetch: mockRefetch });
    mockMutate.mockImplementation((_input, options: { onSuccess?: () => void }) => {
      options.onSuccess?.();
    });

    await render(<NoteScreen />);

    await fireEvent.changeText(screen.getByTestId("add-note-input"), "Ate a bug");
    await fireEvent.press(screen.getByTestId("add-note-save"));

    // The mutation itself is un-delayed.
    expect(mockMutate).toHaveBeenCalledWith({ text: "Ate a bug", photoKeys: [] }, expect.anything());
    expect(screen.getByTestId("note-saved-confirmation")).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1200);
    });

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("an empty save shows the inline error and does not call the mutation", async () => {
    mockedUsePet.mockReturnValue({ data: FIXTURE_PET, isLoading: false, isError: false, refetch: mockRefetch });

    await render(<NoteScreen />);

    await fireEvent.press(screen.getByTestId("add-note-save"));

    expect(screen.getByTestId("add-note-error")).toBeTruthy();
    expect(mockMutate).not.toHaveBeenCalled();
  });
});
