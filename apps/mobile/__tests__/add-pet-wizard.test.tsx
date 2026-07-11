import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import BreedScreen from "../app/add-pet/breed";
import DetailsScreen from "../app/add-pet/details";
import PhotoScreen from "../app/add-pet/photo";
import SpeciesScreen from "../app/add-pet/species";
import { useBreedSearch } from "../src/api/breeds-api";
import { useAddPetStore } from "../src/pets/add-pet-store";
import { strings } from "../src/strings";

// Per-step validation (T024 plan §Tests): species required, details
// name-required + XOR, breed autocomplete + skip, photo skip + picker flow.
// `expo-router` and the breed-search query hook are mocked; every other
// native module is mocked globally in `jest.setup.ts`.
const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }),
}));

jest.mock("../src/api/breeds-api", () => ({
  useBreedSearch: jest.fn(),
}));

const mockedUseBreedSearch = useBreedSearch as unknown as jest.Mock;

describe("add-pet wizard per-step validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAddPetStore.getState().reset();
  });

  describe("species step", () => {
    it("disables Next until a species is chosen, then advances on selection", async () => {
      await render(<SpeciesScreen />);

      await fireEvent.press(screen.getByTestId("wizard-next"));
      expect(mockPush).not.toHaveBeenCalled();

      await fireEvent.press(screen.getByTestId("species-card-dog"));
      expect(useAddPetStore.getState().draft.species).toBe("DOG");

      await fireEvent.press(screen.getByTestId("wizard-next"));
      expect(mockPush).toHaveBeenCalledWith("/add-pet/breed");
    });
  });

  describe("details step", () => {
    it("requires a name before advancing", async () => {
      await render(<DetailsScreen />);

      await fireEvent.press(screen.getByTestId("wizard-next"));

      expect(screen.getByText(strings.addPet.details.nameRequired)).toBeTruthy();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("rejects both a birth date and an age estimate (XOR)", async () => {
      await render(<DetailsScreen />);

      await fireEvent.changeText(screen.getByTestId("details-name-input"), "Rex");
      await fireEvent.changeText(screen.getByTestId("details-birthdate-input"), "2022-05-01");
      await fireEvent.changeText(screen.getByTestId("details-age-input"), "6");
      await fireEvent.press(screen.getByTestId("wizard-next"));

      expect(screen.getByText(strings.addPet.details.xorError)).toBeTruthy();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("advances to the photo step with just a name", async () => {
      await render(<DetailsScreen />);

      await fireEvent.changeText(screen.getByTestId("details-name-input"), "Rex");
      await fireEvent.press(screen.getByTestId("wizard-next"));

      expect(mockPush).toHaveBeenCalledWith("/add-pet/photo");
    });
  });

  describe("breed step", () => {
    it("renders mocked autocomplete results and updates the draft on selection", async () => {
      mockedUseBreedSearch.mockReturnValue({
        data: [{ slug: "labrador", name: "Labrador" }],
        isLoading: false,
        isError: false,
      });
      useAddPetStore.getState().setField("species", "DOG");

      await render(<BreedScreen />);

      expect(screen.getByTestId("breed-row-labrador")).toBeTruthy();
      await fireEvent.press(screen.getByTestId("breed-row-labrador"));

      expect(useAddPetStore.getState().draft.breedSlug).toBe("labrador");
      expect(useAddPetStore.getState().draft.breedName).toBe("Labrador");
      expect(mockPush).toHaveBeenCalledWith("/add-pet/details");
    });

    it("skips with breedSlug left null", async () => {
      mockedUseBreedSearch.mockReturnValue({ data: [], isLoading: false, isError: false });
      useAddPetStore.getState().setField("species", "DOG");

      await render(<BreedScreen />);
      await fireEvent.press(screen.getByTestId("wizard-skip"));

      expect(useAddPetStore.getState().draft.breedSlug).toBeNull();
      expect(useAddPetStore.getState().draft.breedName).toBeNull();
      expect(mockPush).toHaveBeenCalledWith("/add-pet/details");
    });

    it("renders the loading and error branches of the autocomplete", async () => {
      mockedUseBreedSearch.mockReturnValue({ data: undefined, isLoading: true, isError: false });
      const loadingRender = await render(<BreedScreen />);
      expect(screen.getByTestId("breed-loading")).toBeTruthy();
      await loadingRender.unmount();

      mockedUseBreedSearch.mockReturnValue({ data: undefined, isLoading: false, isError: true });
      await render(<BreedScreen />);
      expect(screen.getByTestId("breed-error")).toBeTruthy();
    });
  });

  describe("photo step", () => {
    it("skips with photoUri left null and navigates to done", async () => {
      await render(<PhotoScreen />);

      await fireEvent.press(screen.getByTestId("wizard-skip"));

      expect(useAddPetStore.getState().draft.photoUri).toBeNull();
      expect(mockPush).toHaveBeenCalledWith("/add-pet/done");
    });

    it("runs the picker -> compress flow and previews the compressed image", async () => {
      await render(<PhotoScreen />);

      await fireEvent.press(screen.getByTestId("add-pet-choose-photo"));

      await waitFor(() => {
        expect(useAddPetStore.getState().draft.photoUri).toBe("file:///out.jpg");
      });
      expect(screen.getByTestId("add-pet-photo-preview")).toBeTruthy();
    });
  });
});
