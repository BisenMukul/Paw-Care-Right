import { createQueryClient } from "@pawcareright/api-client";
import { petIdSchema, type Pet } from "@pawcareright/types";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";

import { apiClient } from "../src/api/client";
import { PetFilterChips } from "../src/components/pet-filter-chips";
import { TimelineFilterChips } from "../src/components/timeline-filter-chips";

/**
 * SWEEP-1 plan AC4 (design-system.md §4.1): every filter chip is a
 * `Pressable` reaching the 44pt touch target, still fires its `onChange`,
 * and carries `accessibilityState.selected`. `PetFilterChips` exercises the
 * REAL `usePets()` hook (only `apiClient` is mocked), mirroring
 * `home-screen.test.tsx`.
 */
jest.mock("../src/api/client", () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const mockedGet = apiClient.get as jest.Mock;

const PET_A: Pet = {
  id: petIdSchema.parse("11111111-1111-4111-8111-111111111111"),
  householdId: "household-1",
  species: "DOG",
  sex: "MALE",
  name: "Rex",
  neutered: true,
  breedSlug: null,
  birthDate: null,
  ageEstimateMonths: null,
  weightGrams: null,
  photoKey: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

function createTestQueryClient(): QueryClient {
  return createQueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
}

describe("touch targets: filter chips", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("PetFilterChips", () => {
    it("each chip is a 44pt Pressable, fires onChange, carries accessibilityState.selected", async () => {
      mockedGet.mockResolvedValue([PET_A]);
      const onChange = jest.fn();
      const client = createTestQueryClient();

      await render(<PetFilterChips value={null} onChange={onChange} />, {
        wrapper: makeWrapper(client),
      });

      const all = await screen.findByTestId("filter-chip-all");
      expect(all.props.className).toContain("min-h-[44px]");
      expect(all.props.accessibilityRole).toBe("button");
      expect(all.props.accessibilityState).toEqual({ selected: true });

      const petChip = await screen.findByTestId(`filter-chip-${PET_A.id}`);
      expect(petChip.props.className).toContain("min-h-[44px]");
      expect(petChip.props.accessibilityState).toEqual({ selected: false });

      await fireEvent.press(petChip);
      expect(onChange).toHaveBeenCalledWith(PET_A.id);
    });
  });

  describe("TimelineFilterChips", () => {
    it("each chip is a 44pt Pressable, fires onChange, carries accessibilityState.selected", async () => {
      const onChange = jest.fn();

      await render(<TimelineFilterChips value="NOTE" onChange={onChange} />);

      const all = screen.getByTestId("timeline-filter-chip-all");
      expect(all.props.className).toContain("min-h-[44px]");
      expect(all.props.accessibilityRole).toBe("button");
      expect(all.props.accessibilityState).toEqual({ selected: false });

      const noteChip = screen.getByTestId("timeline-filter-chip-NOTE");
      expect(noteChip.props.className).toContain("min-h-[44px]");
      expect(noteChip.props.accessibilityState).toEqual({ selected: true });

      await fireEvent.press(screen.getByTestId("timeline-filter-chip-ACTIVITY"));
      expect(onChange).toHaveBeenCalledWith("ACTIVITY");
    });
  });
});
