import { createQueryClient, setOnline } from "@pawcareright/api-client";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Share } from "react-native";

import TimelineScreen from "../app/(tabs)/timeline";
import type { TimelineItem } from "../src/api/health-logs-api";
import { useActivePetStore } from "../src/pets/active-pet-store";
import { strings } from "../src/strings";
import * as kindDisplayModule from "../src/health-logs/kind-display";

// T067 plan "Tests to write" -> timeline-screen.test.tsx. `expo-router` and
// `useHealthTimeline` are mocked (the latter via `jest.requireActual` so
// `healthTimelineKeys` -- used by the separate composition describe block
// below -- stays real); the active-pet store is the REAL zustand store;
// offline is driven by the REAL shared store (`setOnline`), reset in
// `afterEach`. RNTL v14 -- every render/rerender is awaited.
const mockPush = jest.fn();
const mockRouter = { push: mockPush };

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
}));

const mockUseHealthTimeline = jest.fn();
// T068: `usePrepareVetSummary` is mocked at the mutation boundary (the
// share flow itself is exercised via a `jest.spyOn(Share, "share")` on the
// REAL `react-native` `Share` module below). Defaults to a non-pending,
// never-resolving-on-its-own mock so every pre-existing test in this file
// (which never presses the new button) is unaffected.
const mockUsePrepareVetSummary = jest.fn();
mockUsePrepareVetSummary.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });

jest.mock("../src/api/health-logs-api", () => ({
  ...jest.requireActual("../src/api/health-logs-api"),
  useHealthTimeline: (petId: string, kind: string | null) => mockUseHealthTimeline(petId, kind),
  usePrepareVetSummary: (petId: string) => mockUsePrepareVetSummary(petId),
}));

// T069: the photo strip/viewer's shared query is mocked at the data
// boundary -- `TimelineRow`/`TimelinePhotoStrip`/`TimelinePhotoViewer`
// themselves are the REAL components, so this proves the full row->strip->
// viewer wiring (the AC "thumbnails in timeline" + viewer open path).
jest.mock("../src/api/pet-photos-api", () => ({
  usePhotoViewUrls: jest.fn(() => ({
    data: {
      items: [
        {
          key: "pets/pet1/original/a.jpg",
          thumbUrl: "https://signed.example/thumb-a",
          mainUrl: "https://signed.example/main-a",
        },
      ],
    },
    isLoading: false,
  })),
}));

function page(items: TimelineItem[], nextCursor: string | null = null) {
  return { data: { pages: [{ items, nextCursor }], pageParams: [undefined] } };
}

const BASE_MOCK = {
  isLoading: false,
  isError: false,
  hasNextPage: false,
  fetchNextPage: jest.fn(),
  isFetchingNextPage: false,
  refetch: jest.fn(),
};

const NOTE_ITEM: TimelineItem = {
  id: "n1",
  kind: "NOTE",
  occurredAt: "2024-03-10T00:00:00.000Z",
  value: { text: "Ate a bug" },
  photoKeys: [],
};

const VALID_CHECK_ITEM: TimelineItem = {
  id: "c1",
  kind: "CHECK_REF",
  occurredAt: "2024-03-09T00:00:00.000Z",
  value: { checkId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d" },
  photoKeys: [],
};

const MALFORMED_CHECK_ITEM: TimelineItem = {
  id: "c2",
  kind: "CHECK_REF",
  occurredAt: "2024-03-08T00:00:00.000Z",
  value: { checkId: "not-a-uuid" },
  photoKeys: [],
};

const PHOTO_ITEM: TimelineItem = {
  id: "p1",
  kind: "NOTE",
  occurredAt: "2024-03-07T00:00:00.000Z",
  value: { text: "With a photo" },
  photoKeys: ["pets/pet1/original/a.jpg"],
};

describe("timeline screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useActivePetStore.getState().setActivePet("pet1");
  });

  afterEach(async () => {
    await act(() => {
      setOnline(true);
    });
    useActivePetStore.getState().clear();
  });

  it("shows the no-pet state when there is no active pet", async () => {
    useActivePetStore.getState().clear();
    mockUseHealthTimeline.mockReturnValue({ ...BASE_MOCK, ...page([]) });

    await render(<TimelineScreen />);

    expect(screen.getByTestId("timeline-no-pet")).toHaveTextContent(strings.timeline.noPet);
  });

  it("shows the loading state", async () => {
    mockUseHealthTimeline.mockReturnValue({ ...BASE_MOCK, data: undefined, isLoading: true });

    await render(<TimelineScreen />);

    expect(screen.getByTestId("timeline-loading")).toBeTruthy();
  });

  it("shows the error state and retry calls refetch", async () => {
    const refetch = jest.fn();
    mockUseHealthTimeline.mockReturnValue({ ...BASE_MOCK, data: undefined, isError: true, refetch });

    await render(<TimelineScreen />);

    expect(screen.getByTestId("timeline-error")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("timeline-retry"));

    expect(refetch).toHaveBeenCalled();
  });

  it("offline with no cached data shows the offline state and retry calls refetch", async () => {
    const refetch = jest.fn();
    mockUseHealthTimeline.mockReturnValue({ ...BASE_MOCK, data: undefined, refetch });
    setOnline(false);

    await render(<TimelineScreen />);

    expect(screen.getByTestId("timeline-offline")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("timeline-retry"));

    expect(refetch).toHaveBeenCalled();
  });

  it("offline with cached data shows a non-blocking banner, list still renders", async () => {
    mockUseHealthTimeline.mockReturnValue({ ...BASE_MOCK, ...page([NOTE_ITEM]) });
    setOnline(false);

    await render(<TimelineScreen />);

    expect(screen.getByTestId("timeline-offline-banner")).toBeTruthy();
    expect(screen.getByTestId("timeline-row-n1")).toBeTruthy();
  });

  it("renders the empty state", async () => {
    mockUseHealthTimeline.mockReturnValue({ ...BASE_MOCK, ...page([]) });

    await render(<TimelineScreen />);

    expect(screen.getByTestId("timeline-empty")).toHaveTextContent(strings.timeline.empty);
  });

  it("groups rows under a device-local month section header", async () => {
    mockUseHealthTimeline.mockReturnValue({ ...BASE_MOCK, ...page([NOTE_ITEM]) });

    await render(<TimelineScreen />);

    expect(screen.getByTestId("timeline-section-2024-03")).toBeTruthy();
    expect(screen.getByTestId("timeline-row-n1")).toBeTruthy();
  });

  it("selecting a kind chip re-queries with that kind", async () => {
    mockUseHealthTimeline.mockReturnValue({ ...BASE_MOCK, ...page([NOTE_ITEM]) });

    await render(<TimelineScreen />);
    await fireEvent.press(screen.getByTestId("timeline-filter-chip-NOTE"));

    const lastCall = mockUseHealthTimeline.mock.calls[mockUseHealthTimeline.mock.calls.length - 1] as [
      string,
      string | null,
    ];
    expect(lastCall).toEqual(["pet1", "NOTE"]);
  });

  it("a CHECK_REF row with a well-formed checkId navigates to the result screen", async () => {
    mockUseHealthTimeline.mockReturnValue({ ...BASE_MOCK, ...page([VALID_CHECK_ITEM]) });

    await render(<TimelineScreen />);
    await fireEvent.press(screen.getByTestId("timeline-row-c1"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/check/result/[checkId]",
      params: { checkId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d" },
    });
  });

  it("a CHECK_REF row with a malformed checkId is non-navigating", async () => {
    mockUseHealthTimeline.mockReturnValue({ ...BASE_MOCK, ...page([MALFORMED_CHECK_ITEM]) });

    await render(<TimelineScreen />);
    await fireEvent.press(screen.getByTestId("timeline-row-c2"));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("onEndReached triggers fetchNextPage when a next page is available", async () => {
    const fetchNextPage = jest.fn();
    mockUseHealthTimeline.mockReturnValue({
      ...BASE_MOCK,
      ...page([NOTE_ITEM], "cursor1"),
      hasNextPage: true,
      fetchNextPage,
    });

    await render(<TimelineScreen />);
    await fireEvent(screen.getByTestId("timeline-list"), "endReached");

    expect(fetchNextPage).toHaveBeenCalled();
  });

  it("onEndReached does not call fetchNextPage again while a fetch is already in flight", async () => {
    const fetchNextPage = jest.fn();
    mockUseHealthTimeline.mockReturnValue({
      ...BASE_MOCK,
      ...page([NOTE_ITEM], "cursor1"),
      hasNextPage: true,
      isFetchingNextPage: true,
      fetchNextPage,
    });

    await render(<TimelineScreen />);
    await fireEvent(screen.getByTestId("timeline-list"), "endReached");

    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  // AC "no full re-render on append (render counts)" -- plan decision 2.
  // `getKindDisplay` is called exactly once per ACTUAL render of a
  // `TimelineRow`; page 1's items (A, B) keep the same object references
  // across the rerender, so if `TimelineRow` is `React.memo`'d and
  // `onPressCheck` is a stable `useCallback`, React bails out of re-running
  // their render bodies entirely -- only the two newly appended rows (C, D)
  // should ever invoke `getKindDisplay` after the page-1 baseline.
  it("appending a page does not re-render existing rows", async () => {
    const spy = jest.spyOn(kindDisplayModule, "getKindDisplay");

    const itemA: TimelineItem = {
      id: "a",
      kind: "NOTE",
      occurredAt: "2024-03-10T00:00:00.000Z",
      value: { text: "A" },
      photoKeys: [],
    };
    const itemB: TimelineItem = {
      id: "b",
      kind: "WEIGHT",
      occurredAt: "2024-03-08T00:00:00.000Z",
      value: { weightGrams: 20000 },
      photoKeys: [],
    };
    const itemC: TimelineItem = {
      id: "c",
      kind: "VET_VISIT",
      occurredAt: "2024-03-05T00:00:00.000Z",
      value: { reason: "C visit" },
      photoKeys: [],
    };
    const itemD: TimelineItem = {
      id: "d",
      kind: "MEAL",
      occurredAt: "2024-03-01T00:00:00.000Z",
      value: { note: "D meal" },
      photoKeys: [],
    };

    const page1Data = { pages: [{ items: [itemA, itemB], nextCursor: "cursor1" }], pageParams: [undefined] };
    const page1and2Data = {
      pages: [
        { items: [itemA, itemB], nextCursor: "cursor1" },
        { items: [itemC, itemD], nextCursor: null },
      ],
      pageParams: [undefined, "cursor1"],
    };

    mockUseHealthTimeline.mockReturnValue({ ...BASE_MOCK, data: page1Data, hasNextPage: true });
    const { rerender } = await render(<TimelineScreen />);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls.map((call) => call[0])).toEqual(["NOTE", "WEIGHT"]);

    spy.mockClear();
    mockUseHealthTimeline.mockReturnValue({ ...BASE_MOCK, data: page1and2Data, hasNextPage: false });
    await rerender(<TimelineScreen />);

    // Only the two NEW rows (C, D) render -- A and B's kinds ("NOTE",
    // "WEIGHT") never appear again, proving their rows were not re-rendered.
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls.map((call) => call[0])).toEqual(["VET_VISIT", "MEAL"]);
  });

  // T069 plan "Tests to write" -> "implied" thumbnails + AC (viewer opens).
  it("a row with photoKeys renders the strip; tapping a thumb opens the viewer", async () => {
    mockUseHealthTimeline.mockReturnValue({ ...BASE_MOCK, ...page([PHOTO_ITEM]) });

    await render(<TimelineScreen />);

    expect(screen.getByTestId("timeline-photo-thumb-p1-0")).toBeTruthy();
    expect(screen.queryByTestId("timeline-photo-viewer-page-0")).toBeNull();

    await fireEvent.press(screen.getByTestId("timeline-photo-thumb-p1-0"));

    expect(screen.getByTestId("timeline-photo-viewer-page-0")).toBeTruthy();
    expect(screen.getByLabelText("Close photo viewer")).toBeTruthy();
  });

  // T068 "Tests to write": share flow mocked at both the Share boundary and
  // the mutation boundary.
  it("Prepare vet summary shares the fetched summary", async () => {
    const summary = "…record digest…This is a record summary generated from entries you logged in the app.";
    const mutateAsync = jest.fn().mockResolvedValue({ summary });
    mockUsePrepareVetSummary.mockReturnValue({ mutateAsync, isPending: false });
    mockUseHealthTimeline.mockReturnValue({ ...BASE_MOCK, ...page([]) });
    const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction", activityType: undefined });

    await render(<TimelineScreen />);
    await fireEvent.press(screen.getByTestId("timeline-vet-summary"));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(1);
      expect(shareSpy).toHaveBeenCalledWith({ message: summary });
    });

    shareSpy.mockRestore();
  });
});

// T067 "BINDING contract": `healthTimelineKeys.list(petId, kind)` is built
// on top of `healthTimelineKeys.pet(petId)`, so a T066 mutation's
// `invalidateQueries({ queryKey: healthTimelineKeys.pet(petId) })` must
// still invalidate every kind-filtered variant via TanStack's default
// `exact: false` prefix match. Exercises the REAL `QueryClient` (not
// mocked) -- `useHealthTimeline` itself is mocked above, but
// `healthTimelineKeys` passes through unmocked via `jest.requireActual`.
describe("healthTimelineKeys.list composition (T066 invalidation contract)", () => {
  it("invalidating pet(petId) invalidates every kind-filtered variant (prefix match)", async () => {
    const { healthTimelineKeys } = jest.requireActual("../src/api/health-logs-api") as {
      healthTimelineKeys: {
        pet: (petId: string) => readonly string[];
        list: (petId: string, kind: string | null) => readonly string[];
      };
    };
    const client = createQueryClient();
    const noteKey = healthTimelineKeys.list("pet1", "NOTE");
    const allKey = healthTimelineKeys.list("pet1", null);
    client.setQueryData(noteKey, { pages: [], pageParams: [] });
    client.setQueryData(allKey, { pages: [], pageParams: [] });

    expect(client.getQueryState(noteKey)?.isInvalidated).toBe(false);
    expect(client.getQueryState(allKey)?.isInvalidated).toBe(false);

    await client.invalidateQueries({ queryKey: healthTimelineKeys.pet("pet1") });

    expect(client.getQueryState(noteKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(allKey)?.isInvalidated).toBe(true);
  });

  it("does not invalidate a different pet's timeline", async () => {
    const { healthTimelineKeys } = jest.requireActual("../src/api/health-logs-api") as {
      healthTimelineKeys: {
        pet: (petId: string) => readonly string[];
        list: (petId: string, kind: string | null) => readonly string[];
      };
    };
    const client = createQueryClient();
    const otherPetKey = healthTimelineKeys.list("pet2", "NOTE");
    client.setQueryData(otherPetKey, { pages: [], pageParams: [] });

    await client.invalidateQueries({ queryKey: healthTimelineKeys.pet("pet1") });

    expect(client.getQueryState(otherPetKey)?.isInvalidated).toBe(false);
  });
});
