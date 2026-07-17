import { petIdSchema, type Pet } from "@pawcareright/types";
import { render, screen } from "@testing-library/react-native";
import React from "react";

import { AnimatedGradientBackground } from "../src/components/home/animated-gradient-background";
import { QuickActionsGrid } from "../src/components/home/quick-actions-grid";
import { PetHeaderCard } from "../src/components/pet-header-card";
import { QuickActions } from "../src/components/quick-actions";

/**
 * SWEEP-1 plan AC2 (design-system.md §3.2): every existing animation is
 * reachable from `useReducedMotion()`. Mocks the single hook module (not
 * the underlying reanimated shim) so each gated component is exercised in
 * isolation, both ways.
 */
jest.mock("../src/hooks/use-reduced-motion", () => ({
  useReducedMotion: jest.fn(),
}));

const mockedUseReducedMotion = jest.requireMock<{ useReducedMotion: jest.Mock }>(
  "../src/hooks/use-reduced-motion",
).useReducedMotion;

const PET: Pet = {
  id: petIdSchema.parse("11111111-1111-4111-8111-111111111111"),
  householdId: "22222222-2222-2222-2222-222222222222",
  species: "DOG",
  sex: "MALE",
  name: "Rex",
  neutered: true,
  breedSlug: "labrador-retriever",
  birthDate: null,
  ageEstimateMonths: null,
  weightGrams: null,
  photoKey: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

describe("reduced-motion gating", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("AnimatedGradientBackground", () => {
    it("reduced: no overlay loop, base gradient still present", async () => {
      mockedUseReducedMotion.mockReturnValue(true);

      await render(<AnimatedGradientBackground />);

      expect(screen.getByTestId("home-gradient-background")).toBeTruthy();
      expect(screen.queryByTestId("home-gradient-overlay")).toBeNull();
    });

    it("not reduced: overlay loop present", async () => {
      mockedUseReducedMotion.mockReturnValue(false);

      await render(<AnimatedGradientBackground />);

      expect(screen.getByTestId("home-gradient-background")).toBeTruthy();
      expect(screen.getByTestId("home-gradient-overlay")).toBeTruthy();
    });
  });

  describe("QuickActionsGrid", () => {
    const props = {
      disabled: false,
      onCheckSymptoms: jest.fn(),
      onLogWeight: jest.fn(),
      onLogActivity: jest.fn(),
      onVetVisit: jest.fn(),
    };

    it("reduced: all four tiles render, entering is undefined", async () => {
      mockedUseReducedMotion.mockReturnValue(true);

      await render(<QuickActionsGrid {...props} />);

      const tile = screen.getByTestId("home-quick-action-check");
      expect(tile).toBeTruthy();
      expect(screen.getByTestId("home-quick-action-weight")).toBeTruthy();
      expect(screen.getByTestId("home-quick-action-activity")).toBeTruthy();
      expect(screen.getByTestId("home-quick-action-vet-visit")).toBeTruthy();
      expect(tile.parent?.props.entering).toBeUndefined();
    });

    it("not reduced: entering is defined", async () => {
      mockedUseReducedMotion.mockReturnValue(false);

      await render(<QuickActionsGrid {...props} />);

      const tile = screen.getByTestId("home-quick-action-check");
      expect(tile.parent?.props.entering).toBeDefined();
    });
  });

  describe("QuickActions", () => {
    const props = {
      onLogWeight: jest.fn(),
      onReminders: jest.fn(),
      onLogActivity: jest.fn(),
      onLogVetVisit: jest.fn(),
    };

    it("reduced: all four tiles render, entering is undefined", async () => {
      mockedUseReducedMotion.mockReturnValue(true);

      await render(<QuickActions {...props} />);

      const tile = screen.getByTestId("quick-action-log-weight");
      expect(tile).toBeTruthy();
      expect(screen.getByTestId("quick-action-log-activity")).toBeTruthy();
      expect(screen.getByTestId("quick-action-log-vet-visit")).toBeTruthy();
      expect(screen.getByTestId("quick-action-reminders")).toBeTruthy();
      expect(tile.parent?.props.entering).toBeUndefined();
    });

    it("not reduced: entering is defined", async () => {
      mockedUseReducedMotion.mockReturnValue(false);

      await render(<QuickActions {...props} />);

      const tile = screen.getByTestId("quick-action-log-weight");
      expect(tile.parent?.props.entering).toBeDefined();
    });
  });

  describe("PetHeaderCard", () => {
    it("reduced: content visible, entering is undefined", async () => {
      mockedUseReducedMotion.mockReturnValue(true);

      await render(<PetHeaderCard pet={PET} />);

      expect(screen.getByTestId("pet-home-name")).toHaveTextContent("Rex");
      expect(screen.getByTestId("pet-home-header-card").props.entering).toBeUndefined();
    });

    it("not reduced: entering is defined", async () => {
      mockedUseReducedMotion.mockReturnValue(false);

      await render(<PetHeaderCard pet={PET} />);

      expect(screen.getByTestId("pet-home-header-card").props.entering).toBeDefined();
    });
  });
});
