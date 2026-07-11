import { petIdSchema, type Pet } from "@pawcareright/types";
import { fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react-native";

import { usePet, usePets } from "../src/api/pets-api";
import { PetSwitcher } from "../src/components/pet-switcher";
import { useActivePetStore } from "../src/pets/active-pet-store";
import { useActivePet } from "../src/pets/use-active-pet";

// Switcher behavior + the AC "switching updates dependent query keys" (T027
// plan §Tests). `usePets`/`usePet` are mocked (`petsKeys` stays real via
// `jest.requireActual`); `expo-router` is mocked so the empty-state CTA can
// render headless.
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("../src/api/pets-api", () => {
  const actual = jest.requireActual("../src/api/pets-api");
  return {
    ...actual,
    usePets: jest.fn(),
    usePet: jest.fn(),
  };
});

const mockedUsePets = usePets as unknown as jest.Mock;
const mockedUsePet = usePet as unknown as jest.Mock;

const PET_A: Pet = {
  id: petIdSchema.parse("11111111-1111-4111-8111-111111111111"),
  householdId: "22222222-2222-2222-2222-222222222222",
  species: "DOG",
  sex: "MALE",
  name: "Alpha",
  neutered: true,
  breedSlug: null,
  birthDate: null,
  ageEstimateMonths: null,
  weightGrams: null,
  photoKey: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const PET_B: Pet = {
  ...PET_A,
  id: petIdSchema.parse("33333333-3333-4333-8333-333333333333"),
  name: "Beta",
};

const PETS_BY_ID: Record<string, Pet> = { [PET_A.id]: PET_A, [PET_B.id]: PET_B };

describe("PetSwitcher", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useActivePetStore.getState().clear();
    mockedUsePet.mockImplementation((id: string) => ({
      data: PETS_BY_ID[id],
      isLoading: false,
      isError: false,
    }));
  });

  it("shows the add-pet CTA when there are no pets", async () => {
    mockedUsePets.mockReturnValue({ data: [], isLoading: false, isError: false });

    await render(<PetSwitcher />);

    expect(screen.getByTestId("pet-switcher-empty-cta")).toBeTruthy();
  });

  it("shows a spinner while loading", async () => {
    mockedUsePets.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    await render(<PetSwitcher />);

    expect(screen.getByTestId("pet-switcher-loading")).toBeTruthy();
  });

  it("shows a static header with no dropdown for a single pet", async () => {
    mockedUsePets.mockReturnValue({ data: [PET_A], isLoading: false, isError: false });

    await render(<PetSwitcher />);

    expect(screen.getByTestId("pet-switcher-active-name")).toHaveTextContent("Alpha");
    expect(screen.queryByTestId("pet-switcher-dropdown-button")).toBeNull();
  });

  it("switching the active pet re-queries dependent data with the new pet id", async () => {
    mockedUsePets.mockReturnValue({ data: [PET_A, PET_B], isLoading: false, isError: false });

    function DependentConsumer() {
      const { activePetId } = useActivePet();
      usePet(activePetId ?? "");
      return null;
    }

    await render(
      <>
        <PetSwitcher />
        <DependentConsumer />
      </>,
    );

    // Auto-heal selects the first pet before any switch.
    await waitFor(() => {
      expect(screen.getByTestId("pet-switcher-active-name")).toHaveTextContent("Alpha");
    });
    expect(mockedUsePet).toHaveBeenLastCalledWith(PET_A.id);

    await fireEvent.press(screen.getByTestId(`pet-switcher-avatar-${PET_B.id}`));

    await waitFor(() => {
      expect(screen.getByTestId("pet-switcher-active-name")).toHaveTextContent("Beta");
    });
    expect(mockedUsePet).toHaveBeenLastCalledWith(PET_B.id);
  });

  it("switching via the dropdown item also re-queries with the new pet id", async () => {
    mockedUsePets.mockReturnValue({ data: [PET_A, PET_B], isLoading: false, isError: false });

    await render(<PetSwitcher />);

    await waitFor(() => {
      expect(screen.getByTestId("pet-switcher-active-name")).toHaveTextContent("Alpha");
    });

    await fireEvent.press(screen.getByTestId("pet-switcher-dropdown-button"));
    await fireEvent.press(screen.getByTestId(`pet-switcher-dropdown-item-${PET_B.id}`));

    await waitFor(() => {
      expect(screen.getByTestId("pet-switcher-active-name")).toHaveTextContent("Beta");
    });
  });
});

describe("useActivePet auto-heal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useActivePetStore.getState().clear();
  });

  it("auto-heals a stale active pet id to the first pet", async () => {
    useActivePetStore.getState().setActivePet("ghost-id");
    mockedUsePets.mockReturnValue({ data: [PET_A, PET_B], isLoading: false, isError: false });

    const { result } = await renderHook(() => useActivePet());

    await waitFor(() => {
      expect(result.current.pet?.id).toBe(PET_A.id);
    });
    expect(useActivePetStore.getState().activePetId).toBe(PET_A.id);
  });
});
