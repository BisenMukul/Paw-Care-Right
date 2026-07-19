import { INTAKE_CATEGORIES } from "@pawcareright/types";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import * as ReactNative from "react-native";

import ServicesScreen from "../app/services";
import { ActivityChipGrid } from "../src/components/activity-chip-grid";
import { CategoryGrid } from "../src/components/category-grid";
import { QuickActionsGrid } from "../src/components/home/quick-actions-grid";
import { strings } from "../src/strings";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

/**
 * RESPONSIVE-1 plan: wide (>=768dp) vs regular column-count widening for the
 * four enumerated grids (category-grid, quick-actions-grid,
 * activity-chip-grid, services/index -- services covered in its own hub
 * suite alongside `services-hub.test.tsx`). testIDs, touch targets
 * (`min-h-[44px]`), reduced-motion gating, and disabled state must survive
 * unchanged in both buckets.
 */
function spyWidth(width: number) {
  return jest.spyOn(ReactNative, "useWindowDimensions").mockReturnValue({
    width,
    height: 1200,
    scale: 2,
    fontScale: 1,
  });
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("CategoryGrid: wide vs regular column widths", () => {
  it("wide (900): tiles use w-[18%] (5 cols) and keep min-h-[44px]", async () => {
    spyWidth(900);

    await render(<CategoryGrid onSelect={jest.fn()} />);

    const [firstCategory] = INTAKE_CATEGORIES;
    const cell = screen.getByTestId(`check-category-${firstCategory!.id}`);
    expect(cell.props.className).toContain("w-[18%]");
    expect(cell.props.className).toContain("min-h-[44px]");
    expect(cell.props.className).not.toContain("w-[30%]");
  });

  it("regular (390): tiles keep w-[30%] (byte-identical to today)", async () => {
    spyWidth(390);

    await render(<CategoryGrid onSelect={jest.fn()} />);

    const [firstCategory] = INTAKE_CATEGORIES;
    const cell = screen.getByTestId(`check-category-${firstCategory!.id}`);
    expect(cell.props.className).toBe(
      "min-h-[44px] w-[30%] items-center gap-2 rounded-2xl bg-white dark:bg-surface-card-dark px-4 py-5 shadow-md",
    );
  });
});

describe("QuickActionsGrid: wide vs regular column widths", () => {
  const baseProps = {
    disabled: false,
    onCheckSymptoms: jest.fn(),
    onLogWeight: jest.fn(),
    onLogActivity: jest.fn(),
    onVetVisit: jest.fn(),
  };

  it("wide (900): tiles use basis-[22%] (4 cols); testIDs + disabled logic intact", async () => {
    spyWidth(900);

    await render(<QuickActionsGrid {...baseProps} disabled />);

    const tile = screen.getByTestId("home-quick-action-check");
    expect(tile.parent?.props.className).toContain("basis-[22%]");
    expect(tile.parent?.props.className).not.toContain("basis-[45%]");
    expect(tile.props.accessibilityState).toEqual({ disabled: true });
  });

  it("regular (390): tiles keep basis-[45%] (byte-identical to today)", async () => {
    spyWidth(390);

    await render(<QuickActionsGrid {...baseProps} />);

    const tile = screen.getByTestId("home-quick-action-check");
    expect(tile.parent?.props.className).toBe("min-w-[45%] flex-1 basis-[45%]");
  });
});

describe("ActivityChipGrid: wide vs regular column widths", () => {
  it("wide (900): tiles use basis-[18%] (5 cols); testID + a11y label intact", async () => {
    spyWidth(900);

    await render(<ActivityChipGrid onSelect={jest.fn()} />);

    const tile = screen.getByTestId("activity-chip-WALK");
    expect(tile.props.className).toContain("basis-[18%]");
    expect(tile.props.className).not.toContain("basis-[28%]");
    expect(tile.props.accessibilityLabel).toBe(strings.activity.typeChipA11y(strings.activity.typeLabel.WALK));
  });

  it("regular (390): tiles keep basis-[28%] (byte-identical to today)", async () => {
    spyWidth(390);

    await render(<ActivityChipGrid onSelect={jest.fn()} />);

    const tile = screen.getByTestId("activity-chip-WALK");
    expect(tile.props.className).toBe(
      "min-w-[28%] flex-1 basis-[28%] items-center gap-2 rounded-2xl bg-white dark:bg-surface-card-dark shadow-md px-3 py-5",
    );
  });
});

describe("services/index: wide 2-col wrap vs regular stacked list", () => {
  it("wide (900): card container wraps flex-row, each card carries basis-[48%] grow; all services-card-* testIDs present", async () => {
    spyWidth(900);

    await render(<ServicesScreen />);

    const vetCard = screen.getByTestId("services-card-vet");
    expect(vetCard.props.className).toContain("basis-[48%]");
    expect(vetCard.props.className).toContain("grow");
    expect(vetCard.parent?.props.className).toContain("flex-row");
    expect(vetCard.parent?.props.className).toContain("flex-wrap");

    for (const key of ["vet", "salon", "store", "adoption", "insurance"] as const) {
      expect(screen.getByTestId(`services-card-${key}`)).toBeTruthy();
      expect(screen.getByTestId(`services-badge-${key}`)).toBeTruthy();
    }
    expect(screen.getByTestId("services-preview-banner")).toBeTruthy();
  });

  it("regular (390): card container stays exactly gap-3, cards render without the wide className", async () => {
    spyWidth(390);

    await render(<ServicesScreen />);

    const vetCard = screen.getByTestId("services-card-vet");
    expect(vetCard.parent?.props.className).toBe("gap-3");
    expect(vetCard.props.className).not.toContain("basis-[48%]");
  });
});
