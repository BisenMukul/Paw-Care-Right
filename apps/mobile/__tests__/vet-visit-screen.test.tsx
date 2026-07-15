import { setOnline } from "@pawcareright/api-client";
import { petIdSchema, type Pet } from "@pawcareright/types";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import VetVisitScreen from "../app/vet-visit/[petId]";
import { useAddVetVisit } from "../src/api/health-logs-api";
import { usePet } from "../src/api/pets-api";

/**
 * Vet-visit screen (T066 plan "Tests to write" — vet-visit-screen.test.tsx).
 * Same skeleton as `note-screen.test.tsx`.
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

const mockedUsePet = usePet as unknown as jest.Mock;
const mockedUseAddVetVisit = useAddVetVisit as unknown as jest.Mock;

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
  });

  afterEach(async () => {
    await act(() => {
      setOnline(true);
    });
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

  it("a valid save calls the mutation with the validated value and then router.back()", async () => {
    mockedUsePet.mockReturnValue({ data: FIXTURE_PET, isLoading: false, isError: false, refetch: mockRefetch });
    mockMutate.mockImplementation((_value, options: { onSuccess?: () => void }) => {
      options.onSuccess?.();
    });

    await render(<VetVisitScreen />);

    await fireEvent.changeText(screen.getByTestId("add-vet-visit-reason"), "Annual checkup");
    await fireEvent.changeText(screen.getByTestId("add-vet-visit-clinic"), "Maple Vet");
    await fireEvent.press(screen.getByTestId("add-vet-visit-save"));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        { reason: "Annual checkup", clinicName: "Maple Vet" },
        expect.anything(),
      );
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("an empty reason shows the inline error and does not call the mutation", async () => {
    mockedUsePet.mockReturnValue({ data: FIXTURE_PET, isLoading: false, isError: false, refetch: mockRefetch });

    await render(<VetVisitScreen />);

    await fireEvent.press(screen.getByTestId("add-vet-visit-save"));

    expect(screen.getByTestId("add-vet-visit-error-reason")).toBeTruthy();
    expect(mockMutate).not.toHaveBeenCalled();
  });
});
