import { setOnline } from "@pawcareright/api-client";
import { petIdSchema, type Pet } from "@pawcareright/types";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { useEffect } from "react";

import VetVisitScreen from "../app/vet-visit/[petId]";
import { useAddVetVisit } from "../src/api/health-logs-api";
import { usePet } from "../src/api/pets-api";
import { HealthLogPhotoPicker } from "../src/components/health-log-photo-picker";

/**
 * Vet-visit screen (T066 plan "Tests to write" — vet-visit-screen.test.tsx).
 * Same skeleton as `note-screen.test.tsx`. `HealthLogPhotoPicker` is mocked
 * (T069 plan "Modify" list) -- default is a no-op stub (proves an untouched
 * picker posts an empty `photoKeys`); one test overrides the mock to invoke
 * `onKeysChange` on mount (proves the picker's keys reach the mutation, the
 * AC "upload reuse tests").
 */
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ petId: "pet1" }),
  useRouter: () => ({ back: mockBack }),
}));

jest.mock("../src/api/pets-api", () => ({
  usePet: jest.fn(),
}));

jest.mock("../src/api/health-logs-api", () => ({
  useAddVetVisit: jest.fn(),
}));

jest.mock("../src/components/health-log-photo-picker", () => ({
  HealthLogPhotoPicker: jest.fn(() => null),
}));

const mockedUsePet = usePet as unknown as jest.Mock;
const mockedUseAddVetVisit = useAddVetVisit as unknown as jest.Mock;
const mockedHealthLogPhotoPicker = HealthLogPhotoPicker as unknown as jest.Mock;

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

describe("vet visit screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAddVetVisit.mockReturnValue({ mutate: mockMutate, isPending: false });
    mockedHealthLogPhotoPicker.mockImplementation(() => null);
  });

  afterEach(async () => {
    await act(() => {
      setOnline(true);
    });
    jest.useRealTimers();
  });

  it("loading: shows vet-visit-screen-loading", async () => {
    mockedUsePet.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: mockRefetch });

    await render(<VetVisitScreen />);

    expect(screen.getByTestId("vet-visit-screen-loading")).toBeTruthy();
  });

  it("error: shows vet-visit-screen-error; retry calls refetch once", async () => {
    mockedUsePet.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: mockRefetch });

    await render(<VetVisitScreen />);

    expect(screen.getByTestId("vet-visit-screen-error")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("vet-visit-screen-retry"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("offline (no cache): shows vet-visit-screen-offline; retry calls refetch", async () => {
    mockedUsePet.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: mockRefetch });
    setOnline(false);

    await render(<VetVisitScreen />);

    expect(screen.getByTestId("vet-visit-screen-offline")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("vet-visit-screen-retry"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("empty/not-found: shows vet-visit-screen-empty", async () => {
    mockedUsePet.mockReturnValue({ data: null, isLoading: false, isError: false, refetch: mockRefetch });

    await render(<VetVisitScreen />);

    expect(screen.getByTestId("vet-visit-screen-empty")).toBeTruthy();
  });

  it("loaded (offline, cached): shows the offline banner over content", async () => {
    mockedUsePet.mockReturnValue({ data: FIXTURE_PET, isLoading: false, isError: false, refetch: mockRefetch });
    setOnline(false);

    await render(<VetVisitScreen />);

    expect(screen.getByTestId("vet-visit-screen-offline-banner")).toBeTruthy();
  });

  // CRAFT-1 plan §7.4: the relocated save button is a descendant of the
  // scaffold's bottom-pinned footer region.
  it("the save button is bottom-pinned inside the screen-scaffold footer", async () => {
    mockedUsePet.mockReturnValue({ data: FIXTURE_PET, isLoading: false, isError: false, refetch: mockRefetch });

    await render(<VetVisitScreen />);

    const footer = screen.getByTestId("screen-scaffold-footer");
    const button = screen.getByTestId("add-vet-visit-save");
    expect(footer).toContainElement(button);
  });

  // CRAFT-1 plan §7.5 Peak-End (R1): the mutation fires and completes
  // un-delayed; ONLY `router.back()` is deferred by `CONFIRM_MS`, so the
  // "called exactly once" assertion below is preserved, not weakened --
  // fake timers must be advanced to observe it.
  it("a valid save calls the mutation with the validated value immediately, shows the save confirmation, then defers router.back()", async () => {
    jest.useFakeTimers();
    mockedUsePet.mockReturnValue({ data: FIXTURE_PET, isLoading: false, isError: false, refetch: mockRefetch });
    mockMutate.mockImplementation((_value, options: { onSuccess?: () => void }) => {
      options.onSuccess?.();
    });

    await render(<VetVisitScreen />);

    await fireEvent.changeText(screen.getByTestId("add-vet-visit-reason"), "Annual checkup");
    await fireEvent.changeText(screen.getByTestId("add-vet-visit-clinic"), "Maple Vet");
    await fireEvent.press(screen.getByTestId("add-vet-visit-save"));

    expect(mockMutate).toHaveBeenCalledWith(
      { value: { reason: "Annual checkup", clinicName: "Maple Vet" }, photoKeys: [] },
      expect.anything(),
    );
    expect(screen.getByTestId("vet-visit-saved-confirmation")).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1200);
    });

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  // AC "Upload reuse tests" (VET_VISIT) -- T069 plan. The picker's own
  // upload machinery is covered by `health-log-photo-picker.test.tsx`; this
  // proves the T066 picker's `onKeysChange` output reaches the VET_VISIT
  // mutation unchanged.
  it("a valid save posts the entered value and the picker's photoKeys", async () => {
    mockedUsePet.mockReturnValue({ data: FIXTURE_PET, isLoading: false, isError: false, refetch: mockRefetch });
    mockedHealthLogPhotoPicker.mockImplementation(({ onKeysChange }: { onKeysChange: (keys: string[]) => void }) => {
      useEffect(() => {
        onKeysChange(["vk1"]);
      }, []);
      return null;
    });
    mockMutate.mockImplementation((_vars, options: { onSuccess?: () => void }) => {
      options.onSuccess?.();
    });

    await render(<VetVisitScreen />);

    await fireEvent.changeText(screen.getByTestId("add-vet-visit-reason"), "Annual checkup");
    await fireEvent.press(screen.getByTestId("add-vet-visit-save"));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        { value: { reason: "Annual checkup" }, photoKeys: ["vk1"] },
        expect.anything(),
      );
    });
  });

  it("an empty reason shows the inline error and does not call the mutation", async () => {
    mockedUsePet.mockReturnValue({ data: FIXTURE_PET, isLoading: false, isError: false, refetch: mockRefetch });

    await render(<VetVisitScreen />);

    await fireEvent.press(screen.getByTestId("add-vet-visit-save"));

    expect(screen.getByTestId("add-vet-visit-error-reason")).toBeTruthy();
    expect(mockMutate).not.toHaveBeenCalled();
  });
});
