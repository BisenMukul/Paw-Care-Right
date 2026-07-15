import { setOnline } from "@pawcareright/api-client";
import { petIdSchema, type Pet } from "@pawcareright/types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import WeightScreen from "../app/weight/[petId]";
import { useAddWeight, useWeightSeries } from "../src/api/health-logs-api";
import { usePet } from "../src/api/pets-api";
import { useWeightUnit } from "../src/weight/weight-unit-store";

/**
 * Weight chart screen (T065 plan "Tests to write" — weight-screen.test.tsx).
 * `pets-api`/`health-logs-api`/`weight-unit-store` hooks and `expo-router`
 * are mocked (mirrors `care-plan-wizard.test.tsx`); offline is driven by the
 * REAL shared store (`setOnline`, mirrors `pet-home-screen.test.tsx`).
 */
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ petId: "pet1" }),
}));

jest.mock("../src/api/pets-api", () => ({
  usePet: jest.fn(),
}));

jest.mock("../src/api/health-logs-api", () => ({
  useWeightSeries: jest.fn(),
  useAddWeight: jest.fn(),
}));

jest.mock("../src/weight/weight-unit-store", () => ({
  useWeightUnit: jest.fn(),
}));

const mockedUsePet = usePet as unknown as jest.Mock;
const mockedUseWeightSeries = useWeightSeries as unknown as jest.Mock;
const mockedUseAddWeight = useAddWeight as unknown as jest.Mock;
const mockedUseWeightUnit = useWeightUnit as unknown as jest.Mock;

const mockRefetch = jest.fn();
const mockToggle = jest.fn();
const mockMutate = jest.fn();

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

describe("weight screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseWeightUnit.mockReturnValue({ unit: "kg", toggle: mockToggle });
    mockedUseWeightSeries.mockReturnValue({ data: { points: [], sampled: false } });
    mockedUseAddWeight.mockReturnValue({ mutate: mockMutate, isPending: false });
  });

  afterEach(async () => {
    await act(() => {
      setOnline(true);
    });
  });

  it("loading: shows weight-screen-loading", async () => {
    mockedUsePet.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: mockRefetch });

    await render(<WeightScreen />);

    expect(screen.getByTestId("weight-screen-loading")).toBeTruthy();
  });

  it("error: shows weight-screen-error; retry calls refetch once", async () => {
    mockedUsePet.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: mockRefetch });

    await render(<WeightScreen />);

    expect(screen.getByTestId("weight-screen-error")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("weight-screen-retry"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("offline (no cache): shows weight-screen-offline; retry calls refetch", async () => {
    mockedUsePet.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: mockRefetch });
    setOnline(false);

    await render(<WeightScreen />);

    expect(screen.getByTestId("weight-screen-offline")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("weight-screen-retry"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("empty/not-found: shows weight-screen-empty", async () => {
    mockedUsePet.mockReturnValue({ data: null, isLoading: false, isError: false, refetch: mockRefetch });

    await render(<WeightScreen />);

    expect(screen.getByTestId("weight-screen-empty")).toBeTruthy();
  });

  it("loaded (offline, cached): shows the offline banner over content", async () => {
    mockedUsePet.mockReturnValue({ data: FIXTURE_PET, isLoading: false, isError: false, refetch: mockRefetch });
    setOnline(false);

    await render(<WeightScreen />);

    expect(screen.getByTestId("weight-screen-offline-banner")).toBeTruthy();
  });

  it("loaded: add button opens the form; submitting a valid value calls the mutation with converted grams", async () => {
    mockedUsePet.mockReturnValue({ data: FIXTURE_PET, isLoading: false, isError: false, refetch: mockRefetch });

    await render(<WeightScreen />);

    expect(screen.queryByTestId("add-weight-input")).toBeNull();
    await fireEvent.press(screen.getByTestId("weight-add-button"));
    expect(screen.getByTestId("add-weight-input")).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId("add-weight-input"), "25");
    await fireEvent.press(screen.getByTestId("add-weight-save"));

    expect(mockMutate).toHaveBeenCalledWith({ grams: 25000 }, expect.anything());
  });

  it("renders the chart's band caption when the pet has a resolvable breed", async () => {
    mockedUsePet.mockReturnValue({ data: FIXTURE_PET, isLoading: false, isError: false, refetch: mockRefetch });
    mockedUseWeightSeries.mockReturnValue({
      data: { points: [{ t: "2024-01-01T00:00:00.000Z", grams: 25000 }], sampled: false },
    });

    await render(<WeightScreen />);

    expect(screen.getByTestId("weight-chart-band-caption")).toBeTruthy();
  });
});
