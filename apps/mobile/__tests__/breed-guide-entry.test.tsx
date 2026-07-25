import { petIdSchema, type Pet } from "@pawcareright/types";
import { fireEvent, render, screen } from "@testing-library/react-native";

import SettingsScreen from "../app/(tabs)/settings";
import PetHomeScreen from "../app/pets/[id]";
import { useEntitlement } from "../src/api/billing-api";
import { usePet } from "../src/api/pets-api";
import { strings } from "../src/strings";

/**
 * T087 plan (AC2/cross-cutting safety) — the two entry points (D5): the
 * conditional pet-profile "About {breed}" row, and the global Settings row
 * that keeps the explore list reachable for pets without a published-guide
 * breed. Mirrors `pet-home-screen.test.tsx` / `settings-sign-out.test.tsx`'s
 * established mocking patterns.
 */
const mockPush = jest.fn();
const mockCanGoBack = jest.fn(() => true);

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), canGoBack: mockCanGoBack }),
  useLocalSearchParams: () => ({ id: "pet1" }),
}));

jest.mock("../src/api/pets-api", () => ({
  usePet: jest.fn(),
}));

jest.mock("../src/api/billing-api", () => ({
  useEntitlement: jest.fn(),
}));

// T091: see sweep4-a11y.test.tsx's identical mock for why this is needed.
jest.mock("../src/api/privacy-api", () => ({
  usePrivacySettings: jest.fn(() => ({ data: undefined })),
  useUpdatePrivacySettings: jest.fn(() => ({ mutateAsync: jest.fn() })),
}));

const mockedUsePet = usePet as unknown as jest.Mock;
const mockedUseEntitlement = useEntitlement as unknown as jest.Mock;

function makePet(overrides: Partial<Pet>): Pet {
  return {
    id: petIdSchema.parse("11111111-1111-4111-8111-111111111111"),
    householdId: "22222222-2222-2222-2222-222222222222",
    species: "DOG",
    sex: "MALE",
    name: "Rex",
    neutered: true,
    breedSlug: null,
    birthDate: "2022-01-15T00:00:00.000Z",
    ageEstimateMonths: null,
    weightGrams: 25000,
    photoKey: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("pet-profile breed guide entry point", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([["a draft breed", "beagle"], ["an unknown breed", "not-a-breed"], ["no breed", null]])(
    "no About row for a pet with %s",
    async (_label, breedSlug) => {
      mockedUsePet.mockReturnValue({
        data: makePet({ breedSlug: breedSlug as Pet["breedSlug"] }),
        isLoading: false,
        isError: false,
        isFetching: false,
        refetch: jest.fn(),
      });

      await render(<PetHomeScreen />);
      expect(screen.queryByTestId("pet-home-breed-guide")).toBeNull();
    },
  );

  it("About row appears for a published-guide breed", async () => {
    mockedUsePet.mockReturnValue({
      data: makePet({ breedSlug: "labrador-retriever" }),
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: jest.fn(),
    });

    await render(<PetHomeScreen />);

    const row = screen.getByTestId("pet-home-breed-guide");
    expect(row).toBeTruthy();
    expect(row).toHaveTextContent(strings.breedGuide.title("Labrador Retriever"), { exact: false });
  });

  it("pet-profile row deep-links with the canonical params", async () => {
    mockedUsePet.mockReturnValue({
      data: makePet({ breedSlug: "labrador-retriever" }),
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: jest.fn(),
    });

    await render(<PetHomeScreen />);

    await fireEvent.press(screen.getByTestId("pet-home-breed-guide"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/breeds/[species]/[slug]",
      params: { species: "dog", slug: "labrador-retriever" },
    });
  });
});

describe("settings breed guides entry point", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseEntitlement.mockReturnValue({ data: undefined });
  });

  it("renders the settings-breed-guides row with the expected label", async () => {
    await render(<SettingsScreen />);

    const row = screen.getByTestId("settings-breed-guides");
    expect(row).toHaveTextContent(strings.settings.breedGuides, { exact: false });
  });

  it("settings row opens the explore list", async () => {
    await render(<SettingsScreen />);

    await fireEvent.press(screen.getByTestId("settings-breed-guides"));

    expect(mockPush).toHaveBeenCalledWith("/breeds");
  });
});
