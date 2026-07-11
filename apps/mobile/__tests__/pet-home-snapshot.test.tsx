import { petIdSchema, type Pet } from "@pawcareright/types";
import { render } from "@testing-library/react-native";

import PetHomeScreen from "../app/pets/[id]";
import { usePet } from "../src/api/pets-api";

// 4 stable snapshots (T025 plan §Tests AC1 "Snapshot"): loading, error,
// empty, loaded. Time is frozen (fixed fixture + deterministic derived age,
// plan R7) and the photo is a fixed local URI.
const FIXED_MS = new Date("2024-06-15T00:00:00.000Z").getTime();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useLocalSearchParams: () => ({ id: "pet1", localPhoto: "file:///snap.jpg" }),
}));

jest.mock("../src/api/pets-api", () => ({
  usePet: jest.fn(),
}));

const mockedUsePet = usePet as unknown as jest.Mock;

const FIXTURE_PET: Pet = {
  id: petIdSchema.parse("11111111-1111-4111-8111-111111111111"),
  householdId: "22222222-2222-2222-2222-222222222222",
  species: "DOG",
  sex: "MALE",
  name: "Rex",
  neutered: true,
  breedSlug: "labrador-retriever",
  birthDate: "2022-06-15T00:00:00.000Z",
  ageEstimateMonths: null,
  weightGrams: 25000,
  photoKey: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

describe("pet home screen snapshots", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: FIXED_MS });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("loading", async () => {
    mockedUsePet.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: jest.fn(),
    });

    const { toJSON } = await render(<PetHomeScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("error", async () => {
    mockedUsePet.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: jest.fn(),
    });

    const { toJSON } = await render(<PetHomeScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("empty", async () => {
    mockedUsePet.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    const { toJSON } = await render(<PetHomeScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("loaded", async () => {
    mockedUsePet.mockReturnValue({
      data: FIXTURE_PET,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    const { toJSON } = await render(<PetHomeScreen />);
    expect(toJSON()).toMatchSnapshot();
  });
});
