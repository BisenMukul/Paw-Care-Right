import type { AgendaResponse } from "@pawcareright/types";
import { render, screen, waitFor, within } from "@testing-library/react-native";

import CareScreen from "../app/(tabs)/care";

/**
 * Device-vs-server clock drift characterization (T062 plan carry-forward
 * #6 / Risk R6). See `../../api/src/reminders/timezone-matrix.spec.ts`
 * §matrix ("mobile care.tsx (agenda bucketing)" row) for this file's place
 * in the master tz test matrix. `care.tsx` buckets Today/Upcoming using the
 * DEVICE's own `new Date()` (see `localDayKey`/`isToday` in `care.tsx`) --
 * never a server-provided "today" flag. This is a CHARACTERIZATION test: it
 * documents the CURRENT device-clock-driven behavior, it does NOT assert
 * device-vs-server drift is "corrected" (that would be a new task, not
 * T062 -- plan Risk R6). The device clock is pinned via
 * `jest.useFakeTimers({ now })` (mirrors `pet-home-snapshot.test.tsx`);
 * `useAgenda`/`useCompleteOccurrence`/`useSnoozeOccurrence`/`usePets` are
 * mocked directly (already-resolved data, no real TanStack Query network
 * round-trip needed for a pure bucketing assertion) so there is no
 * async/timer race to manage beyond the initial render -- assertions still
 * run inside `waitFor` (T060 race discipline).
 */
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const mockUseAgenda = jest.fn();
jest.mock("../src/api/agenda-api", () => ({
  useAgenda: (...args: unknown[]) => mockUseAgenda(...args),
  useCompleteOccurrence: () => ({ mutateAsync: jest.fn() }),
  useSnoozeOccurrence: () => ({ mutateAsync: jest.fn() }),
}));

jest.mock("../src/api/pets-api", () => ({
  usePets: () => ({ data: [] }),
}));

function mockAgendaData(entries: AgendaResponse["entries"]) {
  mockUseAgenda.mockReturnValue({
    data: { from: "2020-01-01T00:00:00.000Z", to: "2020-02-01T00:00:00.000Z", entries },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  });
}

describe("Care agenda screen -- device-vs-server clock drift (characterization)", () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("buckets a server dueAt into Today per the (pinned) device clock", async () => {
    const pinnedNow = new Date("2026-07-15T10:00:00.000Z");
    jest.useFakeTimers({ now: pinnedNow.getTime() });

    const dueAt = "2026-07-15T18:00:00.000Z"; // later the SAME device-local calendar day
    mockAgendaData([
      { reminderId: "reminder-1", petId: "pet-1", type: "VACCINE", title: "Rabies booster", dueAt, status: "SCHEDULED", virtual: true },
    ]);

    await render(<CareScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("agenda-section-today")).toBeTruthy();
    });
    const dueAtMs = new Date(dueAt).getTime();
    const todaySection = within(screen.getByTestId("agenda-section-today"));
    expect(todaySection.getByTestId(`agenda-item-reminder-1-${dueAtMs}`)).toBeTruthy();
  });

  it("buckets a next-day server dueAt into Upcoming even though it is only minutes away in absolute time (device-local midnight crossing)", async () => {
    // Device clock pinned to 23:00 UTC (== device-local 23:00, this repo's
    // test env TZ is UTC) on 2026-07-15.
    const pinnedNow = new Date("2026-07-15T23:00:00.000Z");
    jest.useFakeTimers({ now: pinnedNow.getTime() });

    // Only 90 minutes later in absolute time, but past device-local midnight.
    const dueAt = "2026-07-16T00:30:00.000Z";
    mockAgendaData([
      { reminderId: "reminder-2", petId: "pet-1", type: "VACCINE", title: "Rabies booster", dueAt, status: "SCHEDULED", virtual: true },
    ]);

    await render(<CareScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("agenda-section-upcoming")).toBeTruthy();
    });
    const dueAtMs = new Date(dueAt).getTime();
    const upcomingSection = within(screen.getByTestId("agenda-section-upcoming"));
    const todaySection = within(screen.getByTestId("agenda-section-today"));
    expect(upcomingSection.getByTestId(`agenda-item-reminder-2-${dueAtMs}`)).toBeTruthy();
    expect(todaySection.queryByTestId(`agenda-item-reminder-2-${dueAtMs}`)).toBeNull();
  });
});
