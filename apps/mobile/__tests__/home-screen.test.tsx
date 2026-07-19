import { createQueryClient, setOnline } from "@pawcareright/api-client";
import { petIdSchema, type AgendaResponse, type Pet } from "@pawcareright/types";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";

import HomeScreen from "../app/(tabs)/index";
import { apiClient } from "../src/api/client";
import { useActivePetStore } from "../src/pets/active-pet-store";
import { strings } from "../src/strings";

/**
 * Home tab (founder UI overhaul plan). Exercises the REAL `useActivePet`/
 * `useAgenda` hooks (only `apiClient` is mocked), mirroring
 * `agenda-screen.test.tsx`'s approach -- `expo-router` is mocked,
 * `react-native-reanimated`/`expo-linear-gradient` are mocked globally in
 * `jest.setup.ts` so entrance/loop animations render instantly and
 * headless. RNTL v14 -- every render/press is awaited.
 */
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

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
  breedSlug: "labrador-retriever",
  birthDate: null,
  ageEstimateMonths: null,
  weightGrams: null,
  photoKey: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const PET_B: Pet = { ...PET_A, id: petIdSchema.parse("22222222-2222-4222-8222-222222222222"), name: "Milo" };

function buildAgenda(entries: AgendaResponse["entries"] = []): AgendaResponse {
  return { from: "2020-01-01T00:00:00.000Z", to: "2020-02-01T00:00:00.000Z", entries };
}

function mockGetRouting(pets: Pet[], agenda: AgendaResponse = buildAgenda()) {
  mockedGet.mockImplementation((path: string) => {
    if (path.startsWith("/v1/pets")) {
      return Promise.resolve(pets);
    }
    if (path.startsWith("/v1/agenda")) {
      return Promise.resolve(agenda);
    }
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
}

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

/** `gcTime: 0` (+ explicit `retry: false`) so no query GC timer outlives the test. */
function createTestQueryClient(): QueryClient {
  return createQueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
}

async function renderScreen() {
  const client = createTestQueryClient();
  return render(<HomeScreen />, { wrapper: makeWrapper(client) });
}

describe("Home screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useActivePetStore.getState().clear();
  });

  afterEach(async () => {
    await act(() => {
      setOnline(true);
    });
  });

  describe("with an active pet", () => {
    it("shows the hero card and 4 enabled quick actions; hides the add-pet CTA", async () => {
      mockGetRouting([PET_A]);

      await renderScreen();

      await waitFor(() => {
        expect(screen.getByTestId("home-open-active-pet")).toBeTruthy();
      });
      expect(screen.getByTestId("home-pet-name")).toHaveTextContent("Rex");
      expect(screen.queryByTestId("home-add-pet-cta")).toBeNull();
      expect(screen.queryByTestId("home-empty-state")).toBeNull();

      // FIDELITY-1: the Care Score card renders for an active pet (the
      // `/v1/agenda` mock above already answers its per-pet agenda query).
      await waitFor(() => {
        expect(screen.getByTestId("home-care-score-card")).toBeTruthy();
      });

      for (const testID of [
        "home-quick-action-check",
        "home-quick-action-weight",
        "home-quick-action-activity",
        "home-quick-action-vet-visit",
      ]) {
        expect(screen.getByTestId(testID).props.accessibilityState?.disabled).toBeFalsy();
      }
    });

    it("each quick action navigates to its expected route with the active pet id", async () => {
      mockGetRouting([PET_A]);

      await renderScreen();

      await waitFor(() => {
        expect(screen.getByTestId("home-open-active-pet")).toBeTruthy();
      });

      await fireEvent.press(screen.getByTestId("home-quick-action-check"));
      expect(mockPush).toHaveBeenCalledWith({ pathname: "/check", params: { petId: PET_A.id } });

      await fireEvent.press(screen.getByTestId("home-quick-action-weight"));
      expect(mockPush).toHaveBeenCalledWith({
        pathname: "/weight/[petId]",
        params: { petId: PET_A.id },
      });

      await fireEvent.press(screen.getByTestId("home-quick-action-activity"));
      expect(mockPush).toHaveBeenCalledWith({
        pathname: "/activity/[petId]",
        params: { petId: PET_A.id },
      });

      await fireEvent.press(screen.getByTestId("home-quick-action-vet-visit"));
      expect(mockPush).toHaveBeenCalledWith({
        pathname: "/vet-visit/[petId]",
        params: { petId: PET_A.id },
      });
    });

    it("pressing the hero card navigates to the pet's home", async () => {
      mockGetRouting([PET_A]);

      await renderScreen();

      await waitFor(() => {
        expect(screen.getByTestId("home-open-active-pet")).toBeTruthy();
      });

      await fireEvent.press(screen.getByTestId("home-open-active-pet"));

      expect(mockPush).toHaveBeenCalledWith({ pathname: "/pets/[id]", params: { id: PET_A.id } });
    });

    it("settings gear navigates to the Settings tab", async () => {
      mockGetRouting([PET_A]);

      await renderScreen();

      await waitFor(() => {
        expect(screen.getByTestId("home-settings-button")).toBeTruthy();
      });

      await fireEvent.press(screen.getByTestId("home-settings-button"));

      expect(mockPush).toHaveBeenCalledWith("/settings");
    });
  });

  describe("multiple pets", () => {
    it("keeps the PetSwitcher accessible alongside the hero card", async () => {
      mockGetRouting([PET_A, PET_B]);

      await renderScreen();

      await waitFor(() => {
        expect(screen.getByTestId("pet-switcher")).toBeTruthy();
      });
      expect(screen.getByTestId("home-open-active-pet")).toBeTruthy();
    });
  });

  describe("loading (SWEEP-1: ScreenScaffold/Skeleton reference adoption)", () => {
    it("shows home-hero-skeleton while the pets query is pending", async () => {
      // Never-resolving `apiClient.get` keeps `usePets()`'s query pending
      // indefinitely, proving the loading hero renders `<Card><Skeleton/></Card>`
      // (plan §AC3 "reference adoption").
      mockedGet.mockImplementation(() => new Promise(() => {}));

      await renderScreen();

      await waitFor(() => {
        expect(screen.getByTestId("home-hero-skeleton")).toBeTruthy();
      });
      expect(screen.queryByTestId("home-empty-state")).toBeNull();
      expect(screen.queryByTestId("home-open-active-pet")).toBeNull();
    });
  });

  describe("no pet", () => {
    it("shows the empty hero with home-add-pet-cta; hides the hero card", async () => {
      mockGetRouting([]);

      await renderScreen();

      await waitFor(() => {
        expect(screen.getByTestId("home-add-pet-cta")).toBeTruthy();
      });
      expect(screen.getByTestId("home-empty-state")).toBeTruthy();
      expect(screen.queryByTestId("home-open-active-pet")).toBeNull();
    });

    it("disables all 4 quick actions (no navigation on press)", async () => {
      mockGetRouting([]);

      await renderScreen();

      await waitFor(() => {
        expect(screen.getByTestId("home-add-pet-cta")).toBeTruthy();
      });

      const testIDs = [
        "home-quick-action-check",
        "home-quick-action-weight",
        "home-quick-action-activity",
        "home-quick-action-vet-visit",
      ];
      for (const testID of testIDs) {
        const tile = screen.getByTestId(testID);
        expect(tile.props.accessibilityState?.disabled).toBe(true);
        await fireEvent.press(tile);
      }

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("Today preview", () => {
    it("shows mocked agenda entries and navigates to Care via See all", async () => {
      const entries: AgendaResponse["entries"] = [
        {
          reminderId: "reminder-1",
          petId: PET_A.id,
          type: "VACCINE",
          title: "Rabies booster",
          dueAt: "2020-01-02T09:00:00.000Z",
          status: "SCHEDULED",
          virtual: true,
        },
        {
          reminderId: "reminder-2",
          petId: PET_A.id,
          type: "MEDICATION",
          title: "Heartworm pill",
          dueAt: "2020-01-03T09:00:00.000Z",
          status: "SCHEDULED",
          virtual: true,
        },
      ];
      mockGetRouting([PET_A], buildAgenda(entries));

      await renderScreen();

      await waitFor(() => {
        expect(screen.getByText("Rabies booster")).toBeTruthy();
      });
      expect(screen.getByText("Heartworm pill")).toBeTruthy();

      await fireEvent.press(screen.getByTestId("home-today-see-all"));
      expect(mockPush).toHaveBeenCalledWith("/care");
    });

    it("empty agenda: shows the friendly empty copy", async () => {
      mockGetRouting([PET_A], buildAgenda([]));

      await renderScreen();

      await waitFor(() => {
        expect(screen.getByTestId("home-today-empty")).toBeTruthy();
      });
    });

    it("error: shows home-today-error; retry re-fetches", async () => {
      mockedGet.mockImplementation((path: string) => {
        if (path.startsWith("/v1/pets")) {
          return Promise.resolve([PET_A]);
        }
        if (path.startsWith("/v1/agenda")) {
          return Promise.reject(new Error("agenda failed"));
        }
        return Promise.reject(new Error(`unexpected GET ${path}`));
      });

      await renderScreen();

      await waitFor(() => {
        expect(screen.getByTestId("home-today-error")).toBeTruthy();
      });

      const callsBefore = mockedGet.mock.calls.filter((c) => (c[0] as string).startsWith("/v1/agenda"))
        .length;
      await fireEvent.press(screen.getByTestId("home-today-retry"));

      await waitFor(() => {
        const callsAfter = mockedGet.mock.calls.filter((c) => (c[0] as string).startsWith("/v1/agenda"))
          .length;
        expect(callsAfter).toBeGreaterThan(callsBefore);
      });
    });
  });

  describe("greeting", () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    /** Mirrors `pet-home-snapshot.test.tsx`'s `jest.useFakeTimers({ now })` pattern -- no `waitFor` needed below since the greeting renders synchronously (it does not depend on any fetched data). */
    function freezeHour(hour: number) {
      jest.useFakeTimers({ now: new Date(2024, 0, 1, hour, 0, 0).getTime() });
    }

    it("shows the morning greeting at 08:00 local", async () => {
      freezeHour(8);
      mockGetRouting([]);

      await renderScreen();
      // Flushes the pending (mocked) agenda-query microtask so its resolution
      // doesn't land outside `act(...)` after this test's assertions run.
      await act(async () => {});

      expect(screen.getByTestId("home-greeting")).toHaveTextContent(strings.home.greetingMorning);
    });

    it("shows the afternoon greeting at 14:00 local", async () => {
      freezeHour(14);
      mockGetRouting([]);

      await renderScreen();
      await act(async () => {});

      expect(screen.getByTestId("home-greeting")).toHaveTextContent(strings.home.greetingAfternoon);
    });

    it("shows the evening greeting at 20:00 local", async () => {
      freezeHour(20);
      mockGetRouting([]);

      await renderScreen();
      await act(async () => {});

      expect(screen.getByTestId("home-greeting")).toHaveTextContent(strings.home.greetingEvening);
    });
  });
});
