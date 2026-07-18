import { render, screen } from "@testing-library/react-native";

import TimelineScreen from "../app/(tabs)/timeline";
import type { TimelineItem } from "../src/api/health-logs-api";
import { useActivePetStore } from "../src/pets/active-pet-store";
import { strings } from "../src/strings";

/**
 * PAWSAATHI-2 plan (scope 4 "Tests to write"): mirrors `timeline-
 * screen.test.tsx`'s mocking pattern (`useHealthTimeline`/
 * `usePrepareVetSummary` mocked at the hook boundary, `active-pet-store` is
 * the REAL zustand store). Asserts the dark restyle landed on the section
 * header + a row, and — since this screen renders zero interpretive AI
 * copy (CLAUDE §7 rule 2, record-only) — that the rendered tree never
 * contains the word "diagnos" in any casing/inflection.
 */
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const mockUseHealthTimeline = jest.fn();
const mockUsePrepareVetSummary = jest.fn();
mockUsePrepareVetSummary.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });

jest.mock("../src/api/health-logs-api", () => ({
  ...jest.requireActual("../src/api/health-logs-api"),
  useHealthTimeline: (petId: string, kind: string | null) => mockUseHealthTimeline(petId, kind),
  usePrepareVetSummary: (petId: string) => mockUsePrepareVetSummary(petId),
}));

jest.mock("../src/api/pet-photos-api", () => ({
  usePhotoViewUrls: jest.fn(() => ({ data: { items: [] }, isLoading: false })),
}));

const NOTE_ITEM: TimelineItem = {
  id: "n1",
  kind: "NOTE",
  occurredAt: "2026-07-10T00:00:00.000Z",
  value: { text: "Ate a bug" },
  photoKeys: [],
};

function page(items: TimelineItem[]) {
  return { data: { pages: [{ items, nextCursor: null }], pageParams: [undefined] } };
}

/**
 * `screen.toJSON()`'s tree preserves raw prop VALUES verbatim (including
 * the `<RefreshControl/>` element this screen passes through to
 * `SectionList`), and that element carries an internal `_owner` fiber
 * link -- a plain `JSON.stringify` on the full tree throws
 * "Converting circular structure to JSON". This replacer breaks cycles
 * (mirrors the standard `WeakSet`-tracked-seen-objects technique) so the
 * rest of the tree's `className` content is still inspectable as a string.
 */
function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, val: unknown) => {
    if (typeof val === "object" && val !== null) {
      if (seen.has(val)) {
        return "[Circular]";
      }
      seen.add(val);
    }
    return val;
  });
}

describe("timeline screen: PAWSAATHI-2 dark restyle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useActivePetStore.getState().setActivePet("pet1");
    mockUseHealthTimeline.mockReturnValue({
      ...page([NOTE_ITEM]),
      isLoading: false,
      isError: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isFetchingNextPage: false,
      refetch: jest.fn(),
      isRefetching: false,
    });
  });

  afterEach(() => {
    useActivePetStore.getState().clear();
  });

  it("section header + a timeline row carry dark variants, and the tree contains no 'diagnos' substring", async () => {
    await render(<TimelineScreen />);

    const sectionHeaders = screen.getAllByTestId(/^timeline-section-/);
    expect(sectionHeaders.length).toBeGreaterThan(0);
    const [firstHeader] = sectionHeaders;
    expect(firstHeader?.props.className).toContain("dark:text-ink-muted-dark");
    expect(firstHeader?.props.className).toContain("font-body-semibold");

    // Confirms the row rendered (frozen testID) before checking its dark
    // token via the serializable `toJSON()` tree.
    expect(screen.getByTestId("timeline-row-n1")).toBeTruthy();
    const rendered = safeStringify(screen.toJSON());
    expect(rendered).toContain("dark:bg-surface-card-dark");
    expect(rendered).not.toMatch(/diagnos/i);
  });

  it("screen title carries dark:text-ink-dark font-display", async () => {
    await render(<TimelineScreen />);

    expect(screen.getByText(strings.timeline.title).props.className).toContain("dark:text-ink-dark");
    expect(screen.getByText(strings.timeline.title).props.className).toContain("font-display");
  });
});
