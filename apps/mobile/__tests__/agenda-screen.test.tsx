import { ApiError, createQueryClient, setOnline } from "@pawcareright/api-client";
import { petIdSchema, type AgendaEntry, type AgendaResponse, type Pet } from "@pawcareright/types";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";

import CareScreen from "../app/(tabs)/care";
import { apiClient } from "../src/api/client";
import { useActivePetStore } from "../src/pets/active-pet-store";

/**
 * Care agenda screen (T060 plan). Deliberately exercises the REAL
 * `agenda-api.ts`/`pets-api.ts` hooks (only `apiClient` is mocked) rather
 * than mocking `useCompleteOccurrence`/`useSnoozeOccurrence` at the module
 * boundary: AC1's rollback assertion must exercise the actual `onMutate`/
 * `onError` cache-patch-then-restore logic in `agenda-api.ts` (plan
 * decision 6) -- a mocked hook could not detect a regression in that logic
 * (see the executor's non-vacuity proof: temporarily deleting the
 * `onError` handler makes this exact test fail). `expo-router` is mocked;
 * offline is driven by the REAL shared store (`setOnline`), reset to
 * online in `afterEach` (mirrors `pet-home-screen.test.tsx`). The active
 * pet store is real (mmkv mocked globally in `jest.setup.ts`), reset per
 * test. RNTL v14 -- every render/press is awaited.
 */
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../src/api/client", () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const mockedGet = apiClient.get as jest.Mock;
const mockedPost = apiClient.post as jest.Mock;

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

const PET_B: Pet = { ...PET_A, id: petIdSchema.parse("22222222-2222-4222-8222-222222222222"), name: "Milo" };

function todayAtIso(hourOffset: number): string {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    (now.getHours() + hourOffset + 24) % 24,
    0,
    0,
    0,
  ).toISOString();
}

function daysFromNowIso(days: number): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 9, 0, 0, 0).toISOString();
}

function buildAgenda(entries: AgendaEntry[]): AgendaResponse {
  return { from: "2020-01-01T00:00:00.000Z", to: "2020-02-01T00:00:00.000Z", entries };
}

function scheduledEntry(overrides: Partial<AgendaEntry> = {}): AgendaEntry {
  return {
    reminderId: "reminder-1",
    petId: PET_A.id,
    type: "VACCINE",
    title: "Rabies booster",
    dueAt: todayAtIso(1),
    status: "SCHEDULED",
    virtual: true,
    ...overrides,
  };
}

/** A never-settling / test-controlled promise (mirrors `checks-api.test.ts`'s deferred-style control). */
function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A 4xx `ApiError` short-circuits the shared `shouldRetry` policy (no retry delay inflating the test). */
function noRetryError(message = "request failed"): ApiError {
  return new ApiError({ code: "VALIDATION_FAILED", message, httpStatus: 400, requestId: null });
}

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

function mockGetRouting(agendaImpl: (path: string) => Promise<AgendaResponse>, pets: Pet[] = []) {
  mockedGet.mockImplementation((path: string) => {
    if (path.startsWith("/v1/pets")) {
      return Promise.resolve(pets);
    }
    if (path.startsWith("/v1/agenda")) {
      return agendaImpl(path);
    }
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
}

/** `gcTime: 0` (+ explicit `retry: false`) so no query/mutation GC timer outlives the test (avoids Jest's "did not exit" warning from a real `QueryClient`). */
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
  return render(<CareScreen />, { wrapper: makeWrapper(client) });
}

describe("Care agenda screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useActivePetStore.getState().clear();
  });

  afterEach(async () => {
    await act(() => {
      setOnline(true);
    });
  });

  it("loading: shows agenda-loading", async () => {
    mockedGet.mockImplementation(() => new Promise<never>(() => {}));

    await renderScreen();

    expect(screen.getByTestId("agenda-loading")).toBeTruthy();
  });

  it("error: shows agenda-error; retry re-fetches the agenda", async () => {
    mockGetRouting(() => Promise.reject(noRetryError()));

    await renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("agenda-error")).toBeTruthy();
    });
    const callsBefore = mockedGet.mock.calls.filter((c) => (c[0] as string).startsWith("/v1/agenda")).length;

    await fireEvent.press(screen.getByTestId("agenda-retry"));

    await waitFor(() => {
      const callsAfter = mockedGet.mock.calls.filter((c) => (c[0] as string).startsWith("/v1/agenda")).length;
      expect(callsAfter).toBeGreaterThan(callsBefore);
    });
  });

  it("offline with no cached data: shows agenda-offline; retry re-fetches", async () => {
    setOnline(false);
    mockGetRouting(() => Promise.reject(noRetryError()));

    await renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("agenda-offline")).toBeTruthy();
    });
    const callsBefore = mockedGet.mock.calls.filter((c) => (c[0] as string).startsWith("/v1/agenda")).length;

    await fireEvent.press(screen.getByTestId("agenda-retry"));

    await waitFor(() => {
      const callsAfter = mockedGet.mock.calls.filter((c) => (c[0] as string).startsWith("/v1/agenda")).length;
      expect(callsAfter).toBeGreaterThan(callsBefore);
    });
  });

  it("offline with cached data: shows the offline banner over the existing agenda", async () => {
    const entry = scheduledEntry();
    const rowTestId = `agenda-item-${entry.reminderId}-${new Date(entry.dueAt).getTime()}`;
    mockGetRouting(() => Promise.resolve(buildAgenda([entry])));

    await renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId(rowTestId)).toBeTruthy();
    });

    await act(async () => {
      setOnline(false);
    });

    expect(screen.getByTestId("agenda-offline-banner")).toBeTruthy();
    expect(screen.getByTestId(rowTestId)).toBeTruthy();
  });

  it("empty: no entries -> shows agenda-empty", async () => {
    mockGetRouting(() => Promise.resolve(buildAgenda([])));

    await renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("agenda-empty")).toBeTruthy();
    });
  });

  it("filter chips: one per household pet plus All; selecting a pet re-queries with petId", async () => {
    mockGetRouting(() => Promise.resolve(buildAgenda([])), [PET_A, PET_B]);

    await renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("filter-chip-all")).toBeTruthy();
      expect(screen.getByTestId(`filter-chip-${PET_A.id}`)).toBeTruthy();
      expect(screen.getByTestId(`filter-chip-${PET_B.id}`)).toBeTruthy();
    });

    await fireEvent.press(screen.getByTestId(`filter-chip-${PET_B.id}`));

    await waitFor(() => {
      const petScoped = mockedGet.mock.calls.some(
        (c) => (c[0] as string).startsWith("/v1/agenda") && (c[0] as string).includes(`petId=${PET_B.id}`),
      );
      expect(petScoped).toBe(true);
    });
  });

  it("splits entries into Today vs Upcoming sections", async () => {
    const todayEntry = scheduledEntry({ reminderId: "reminder-today", dueAt: todayAtIso(1) });
    const upcomingEntry = scheduledEntry({ reminderId: "reminder-upcoming", dueAt: daysFromNowIso(5) });
    mockGetRouting(() => Promise.resolve(buildAgenda([todayEntry, upcomingEntry])));

    await renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("agenda-section-today")).toBeTruthy();
    });

    const todayMs = new Date(todayEntry.dueAt).getTime();
    const upcomingMs = new Date(upcomingEntry.dueAt).getTime();

    const todaySection = within(screen.getByTestId("agenda-section-today"));
    const upcomingSection = within(screen.getByTestId("agenda-section-upcoming"));

    expect(todaySection.getByTestId(`agenda-item-reminder-today-${todayMs}`)).toBeTruthy();
    expect(todaySection.queryByTestId(`agenda-item-reminder-upcoming-${upcomingMs}`)).toBeNull();
    expect(upcomingSection.getByTestId(`agenda-item-reminder-upcoming-${upcomingMs}`)).toBeTruthy();
    expect(upcomingSection.queryByTestId(`agenda-item-reminder-today-${todayMs}`)).toBeNull();
  });

  describe("[AC1] optimistic complete rollback on API failure", () => {
    it("Mark done optimistically shows DONE, then reverts to SCHEDULED after the API call rejects", async () => {
      const entry = scheduledEntry();
      // Only the FIRST agenda GET resolves; every subsequent call (i.e. the
      // `onSettled` invalidate-triggered refetch) hangs forever. This
      // isolates `onError`'s synchronous cache-restore as the ONLY possible
      // mechanism that can revert the row -- a background refetch can never
      // "accidentally" fix the display in this test, so a passing assertion
      // below is proof the mutation's own `onError` ran.
      let agendaCallCount = 0;
      mockGetRouting(() => {
        agendaCallCount += 1;
        if (agendaCallCount === 1) {
          return Promise.resolve(buildAgenda([entry]));
        }
        return new Promise<AgendaResponse>(() => {});
      });
      const deferred = createDeferred<AgendaEntry>();
      mockedPost.mockImplementation((path: string) => {
        if (path === `/v1/reminders/${entry.reminderId}/complete`) {
          return deferred.promise;
        }
        return Promise.reject(new Error(`unexpected POST ${path}`));
      });

      await renderScreen();

      const dueAtMs = new Date(entry.dueAt).getTime();
      const completeTestId = `agenda-item-complete-${entry.reminderId}-${dueAtMs}`;
      const statusTestId = `agenda-item-status-${entry.reminderId}-${dueAtMs}`;

      await waitFor(() => {
        expect(screen.getByTestId(completeTestId)).toBeTruthy();
      });
      expect(screen.queryByTestId(statusTestId)).toBeNull();

      await fireEvent.press(screen.getByTestId(completeTestId));

      // Optimistic: the row shows DONE before the (still-pending) API call settles.
      await waitFor(() => {
        expect(screen.getByTestId(statusTestId)).toBeTruthy();
      });
      expect(screen.queryByTestId(completeTestId)).toBeNull();

      await act(async () => {
        deferred.reject(noRetryError("complete failed"));
        await Promise.resolve().then(() => Promise.resolve());
      });

      // Rollback: reverts to the original SCHEDULED row (no status badge, actions back).
      await waitFor(() => {
        expect(screen.queryByTestId(statusTestId)).toBeNull();
      });
      expect(screen.getByTestId(completeTestId)).toBeTruthy();

      expect(mockedPost).toHaveBeenCalledWith(`/v1/reminders/${entry.reminderId}/complete`, {
        dueAt: entry.dueAt,
      });
    });
  });

  describe("snooze (supporting)", () => {
    it("Snooze optimistically shows SNOOZED, then reverts after the API call rejects", async () => {
      const entry = scheduledEntry();
      // Same isolation as the AC1 test above: only the first agenda GET
      // resolves, so the revert can only come from the mutation's own
      // `onError`, not a lucky background refetch.
      let agendaCallCount = 0;
      mockGetRouting(() => {
        agendaCallCount += 1;
        if (agendaCallCount === 1) {
          return Promise.resolve(buildAgenda([entry]));
        }
        return new Promise<AgendaResponse>(() => {});
      });
      const deferred = createDeferred<AgendaEntry>();
      mockedPost.mockImplementation((path: string) => {
        if (path === `/v1/reminders/${entry.reminderId}/snooze`) {
          return deferred.promise;
        }
        return Promise.reject(new Error(`unexpected POST ${path}`));
      });

      await renderScreen();

      const dueAtMs = new Date(entry.dueAt).getTime();
      const snoozeTestId = `agenda-item-snooze-${entry.reminderId}-${dueAtMs}`;
      const statusTestId = `agenda-item-status-${entry.reminderId}-${dueAtMs}`;

      await waitFor(() => {
        expect(screen.getByTestId(snoozeTestId)).toBeTruthy();
      });

      await fireEvent.press(screen.getByTestId(snoozeTestId));

      await waitFor(() => {
        expect(screen.getByTestId(statusTestId)).toBeTruthy();
      });

      await act(async () => {
        deferred.reject(noRetryError("snooze failed"));
        await Promise.resolve().then(() => Promise.resolve());
      });

      await waitFor(() => {
        expect(screen.queryByTestId(statusTestId)).toBeNull();
      });
      expect(screen.getByTestId(snoozeTestId)).toBeTruthy();

      const call = mockedPost.mock.calls.find((c) => c[0] === `/v1/reminders/${entry.reminderId}/snooze`);
      expect(call?.[1]).toEqual(expect.objectContaining({ dueAt: entry.dueAt }));
    });
  });

  describe("navigation", () => {
    it("agenda-new routes to /reminders/edit with the active pet when no filter is selected", async () => {
      useActivePetStore.getState().setActivePet(PET_A.id);
      mockGetRouting(() => Promise.resolve(buildAgenda([])), [PET_A]);

      await renderScreen();

      await waitFor(() => {
        expect(screen.getByTestId("agenda-new")).toBeTruthy();
      });
      await fireEvent.press(screen.getByTestId("agenda-new"));

      expect(mockPush).toHaveBeenCalledWith({
        pathname: "/reminders/edit",
        params: { petId: PET_A.id },
      });
    });

    it("agenda-care-plan routes to /care-plan/[petId] for the active pet", async () => {
      useActivePetStore.getState().setActivePet(PET_A.id);
      mockGetRouting(() => Promise.resolve(buildAgenda([])), [PET_A]);

      await renderScreen();

      await waitFor(() => {
        expect(screen.getByTestId("agenda-care-plan")).toBeTruthy();
      });
      await fireEvent.press(screen.getByTestId("agenda-care-plan"));

      expect(mockPush).toHaveBeenCalledWith({
        pathname: "/care-plan/[petId]",
        params: { petId: PET_A.id },
      });
    });

    it("no active pet and no filter: agenda-new and agenda-care-plan are not rendered", async () => {
      mockGetRouting(() => Promise.resolve(buildAgenda([])), []);

      await renderScreen();

      await waitFor(() => {
        expect(screen.getByTestId("agenda-empty")).toBeTruthy();
      });
      expect(screen.queryByTestId("agenda-new")).toBeNull();
      expect(screen.queryByTestId("agenda-care-plan")).toBeNull();
    });
  });
});
