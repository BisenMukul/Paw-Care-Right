import { setOnline } from "@pawcareright/api-client";
import { petIdSchema, type Pet } from "@pawcareright/types";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { Dimensions, StyleSheet } from "react-native";
import type { JsonElement, JsonNode } from "test-renderer";

import PetHomeScreen from "../app/pets/[id]";
import { usePet } from "../src/api/pets-api";
import {
  ABOVE_FOLD_BUDGET,
  CTA_HEIGHT,
  HEADER_CARD_HEIGHT,
  SE_WINDOW,
} from "../src/pets/pet-home-layout";

// 4-state matrix + the two above-the-fold assertions (T025 plan §Tests AC1
// and AC2). `expo-router` and `usePet` are mocked; offline is driven by the
// REAL shared store (`setOnline`) from `@pawcareright/api-client`, reset to
// online in `afterEach`. RNTL v14 — every render is awaited.
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ id: "pet1" }),
}));

jest.mock("../src/api/pets-api", () => ({
  usePet: jest.fn(),
}));

const mockedUsePet = usePet as unknown as jest.Mock;
const mockRefetch = jest.fn();

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

function collectTestIds(node: JsonNode, ids: string[]): void {
  if (typeof node === "string") {
    return;
  }
  const { testID } = node.props;
  if (typeof testID === "string") {
    ids.push(testID);
  }
  node.children.forEach((child) => collectTestIds(child, ids));
}

describe("pet home screen — 4-state matrix (AC1)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await act(() => {
      setOnline(true);
    });
  });

  it("loading: shows pet-home-loading, no header/CTA", async () => {
    mockedUsePet.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: mockRefetch,
    });

    await render(<PetHomeScreen />);

    expect(screen.getByTestId("pet-home-loading")).toBeTruthy();
    expect(screen.queryByTestId("pet-home-header-region")).toBeNull();
    expect(screen.queryByTestId("pet-home-cta")).toBeNull();
  });

  it("error: shows pet-home-error; retry calls refetch once", async () => {
    mockedUsePet.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    });

    await render(<PetHomeScreen />);

    expect(screen.getByTestId("pet-home-error")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("pet-home-retry"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("empty/not-found: shows pet-home-empty", async () => {
    mockedUsePet.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    await render(<PetHomeScreen />);

    expect(screen.getByTestId("pet-home-empty")).toBeTruthy();
  });

  it("offline (no cache): shows pet-home-offline; retry calls refetch", async () => {
    mockedUsePet.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });
    setOnline(false);

    await render(<PetHomeScreen />);

    expect(screen.getByTestId("pet-home-offline")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("pet-home-retry"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("offline (cached): shows content plus pet-home-offline-banner (banner-over-cache)", async () => {
    mockedUsePet.mockReturnValue({
      data: FIXTURE_PET,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });
    setOnline(false);

    await render(<PetHomeScreen />);

    expect(screen.getByTestId("pet-home-offline-banner")).toBeTruthy();
    expect(screen.getByTestId("pet-home-header-card")).toBeTruthy();
    expect(screen.getByTestId("pet-home-name")).toHaveTextContent("Rex");
  });

  it("loaded (online): CTA and both quick actions stub-navigate to /coming-soon", async () => {
    mockedUsePet.mockReturnValue({
      data: FIXTURE_PET,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    await render(<PetHomeScreen />);

    expect(screen.queryByTestId("pet-home-offline-banner")).toBeNull();

    await fireEvent.press(screen.getByTestId("pet-home-cta"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/coming-soon",
      params: { feature: "symptom-check" },
    });

    await fireEvent.press(screen.getByTestId("quick-action-log-weight"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/coming-soon",
      params: { feature: "log-weight" },
    });

    await fireEvent.press(screen.getByTestId("quick-action-reminders"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/coming-soon",
      params: { feature: "reminders" },
    });
  });
});

describe("pet home screen — above-the-fold (AC2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUsePet.mockReturnValue({
      data: FIXTURE_PET,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });
  });

  afterEach(async () => {
    await act(() => {
      setOnline(true);
    });
  });

  it("[structural] pins the CTA above/outside the scrollable region", async () => {
    await render(<PetHomeScreen />);

    const scroll = screen.getByTestId("pet-home-scroll");
    expect(within(scroll).queryByTestId("pet-home-cta")).toBeNull();
    expect(screen.getByTestId("pet-home-cta")).toBeTruthy();

    const tree = screen.toJSON();
    const ids: string[] = [];
    if (tree) {
      collectTestIds(tree as JsonElement, ids);
    }
    const headerRegionIndex = ids.indexOf("pet-home-header-region");
    const scrollIndex = ids.indexOf("pet-home-scroll");

    expect(headerRegionIndex).toBeGreaterThanOrEqual(0);
    expect(scrollIndex).toBeGreaterThanOrEqual(0);
    expect(headerRegionIndex).toBeLessThan(scrollIndex);
  });

  it("[budget, non-vacuous] fixed heights fit an iPhone SE window and match the applied styles", async () => {
    jest.spyOn(Dimensions, "get").mockReturnValue({
      width: SE_WINDOW.width,
      height: SE_WINDOW.height,
      scale: 2,
      fontScale: 1,
    });

    expect(ABOVE_FOLD_BUDGET).toBeLessThanOrEqual(Dimensions.get("window").height);

    await render(<PetHomeScreen />);

    const headerCard = screen.getByTestId("pet-home-header-card");
    const cta = screen.getByTestId("pet-home-cta");

    const headerStyle = StyleSheet.flatten(headerCard.props.style);
    const ctaStyle = StyleSheet.flatten(cta.props.style);

    expect(headerStyle.height).toBe(HEADER_CARD_HEIGHT);
    expect(ctaStyle.minHeight).toBe(CTA_HEIGHT);

    // Mirrors the on-device layout pass (RNTL has no real Yoga engine — plan
    // R3); the same constants asserted above as applied styles are what
    // would actually be reported by `onLayout`.
    fireEvent(screen.getByTestId("pet-home-header-region"), "layout", {
      nativeEvent: { layout: { height: HEADER_CARD_HEIGHT, width: SE_WINDOW.width, x: 0, y: 0 } },
    });
    fireEvent(cta, "layout", {
      nativeEvent: { layout: { height: CTA_HEIGHT, width: SE_WINDOW.width, x: 0, y: 0 } },
    });

    jest.restoreAllMocks();
  });
});
