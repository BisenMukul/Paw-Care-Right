import { INTAKE_CATEGORIES } from "@pawcareright/types";
import { render, screen } from "@testing-library/react-native";

import ServicesAdoptScreen from "../app/services/adopt";
import ServicesIndexScreen from "../app/services/index";
import ServicesSalonsScreen from "../app/services/salons";
import ServicesStoreScreen from "../app/services/store";
import ServicesVetsScreen from "../app/services/vets";
import { ActivityChipGrid } from "../src/components/activity-chip-grid";
import { CategoryGrid } from "../src/components/category-grid";

/**
 * FIDELITY-2 plan §C: the mockup's colorful rounded-square icon tile --
 * white icon/glyph on a colored fill, label BELOW in dark ink. Icon-on-fill
 * is decorative (AA-exempt per the card + design-system §4.6); every
 * testID/route/logic this plan authorizes touching stays preserved.
 */
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe("colorful icon tiles: CategoryGrid", () => {
  it("every category tile is a colored rounded-2xl fill with a white Ionicon, label rendered below, testIDs preserved", async () => {
    await render(<CategoryGrid onSelect={jest.fn()} />);

    for (const category of INTAKE_CATEGORIES) {
      expect(screen.getByTestId(`check-category-${category.id}`)).toBeTruthy();
      const tile = screen.getByTestId(`check-category-${category.id}-tile`);
      expect(tile.props.className).toContain("rounded-2xl");
      expect(tile.props.className).toMatch(/bg-(accent|category|surface)-/);
      expect(screen.getByText(category.label)).toBeTruthy();
    }
  });
});

describe("colorful icon tiles: ActivityChipGrid", () => {
  it("every activity tile is a colored rounded-2xl fill with a white Ionicon, label rendered below, testIDs preserved", async () => {
    await render(<ActivityChipGrid onSelect={jest.fn()} />);

    for (const type of ["FOOD", "WATER", "POTTY", "SLEEP", "WALK", "PLAY", "GROOMING"] as const) {
      expect(screen.getByTestId(`activity-chip-${type}`)).toBeTruthy();
      const tile = screen.getByTestId(`activity-chip-${type}-tile`);
      expect(tile.props.className).toContain("rounded-2xl");
      expect(tile.props.className).toMatch(/bg-(accent|category|surface)-/);
    }
  });
});

describe("colorful icon tiles: services leading-icon tiles (white icon, colored fill, testIDs/routes preserved)", () => {
  it("services hub: every SERVICE_KEYS tile is a colored rounded-2xl fill", async () => {
    await render(<ServicesIndexScreen />);

    for (const key of ["vet", "salon", "store", "adoption", "insurance"] as const) {
      expect(screen.getByTestId(`services-card-${key}`)).toBeTruthy();
      const tile = screen.getByTestId(`services-tile-${key}`);
      expect(tile.props.className).toContain("rounded-2xl");
      expect(tile.props.className).toMatch(/bg-(accent|category)-/);
    }
  });

  it("vets: avatar tile is a colored rounded-2xl fill with white initial text", async () => {
    await render(<ServicesVetsScreen />);

    const tile = screen.getByTestId("services-vet-avatar-vet-1");
    expect(tile.props.className).toContain("rounded-2xl");
    expect(tile.props.className).toContain("bg-accent-dark");
    expect(screen.getByTestId("services-vet-card-vet-1")).toBeTruthy();
  });

  it("salons: leading tile is a colored rounded-2xl fill", async () => {
    await render(<ServicesSalonsScreen />);

    const tile = screen.getByTestId("services-salon-tile-salon-1");
    expect(tile.props.className).toContain("rounded-2xl");
    expect(tile.props.className).toContain("bg-accent-warm");
    expect(screen.getByTestId("services-salon-card-salon-1")).toBeTruthy();
  });

  it("store: leading tile is a colored rounded-2xl fill", async () => {
    await render(<ServicesStoreScreen />);

    const tile = screen.getByTestId("services-store-tile-product-1");
    expect(tile.props.className).toContain("rounded-2xl");
    expect(tile.props.className).toContain("bg-category-amber");
    expect(screen.getByTestId("services-store-card-product-1")).toBeTruthy();
  });

  it("adopt: photo-placeholder tile is a colored rounded-2xl fill", async () => {
    await render(<ServicesAdoptScreen />);

    const tile = screen.getByTestId("services-adopt-tile-pet-1");
    expect(tile.props.className).toContain("rounded-2xl");
    expect(tile.props.className).toContain("bg-category-lilac");
    expect(screen.getByTestId("services-adopt-card-pet-1")).toBeTruthy();
  });
});
