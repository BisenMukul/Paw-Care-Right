import { setOnline } from "@pawcareright/api-client";
import { resolveCareTemplateForPet, VET_CONFIRM_SENTENCE } from "@pawcareright/data";
import type { CareTemplateSuggestions } from "@pawcareright/types";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import CarePlanWizardScreen from "../app/care-plan/[petId]";
import { useInstantiateTemplate, useTemplateSuggestions } from "../src/api/care-plan-api";

/**
 * Care-plan setup wizard (T059 plan "Tests to write"). `care-plan-api`
 * hooks, `expo-router`, and `src/checks/region` are mocked (mirrors
 * `emergency-interstitial.test.tsx`'s region mock / `notification-prefs-
 * screen.test.tsx`'s hook mocks); offline is driven by the REAL shared
 * store (`setOnline`), reset to online in `afterEach` (mirrors
 * `pet-home-screen.test.tsx`). RNTL v14 -- every render/press is awaited.
 *
 * AC1's fixtures are built by mapping the REAL
 * `resolveCareTemplateForPet` pack (DOG/PUPPY_KITTEN/IN and
 * CAT/ADULT/DEFAULT) so the assertions prove the wizard mirrors the
 * resolved pack rather than a hardcoded subset.
 */
const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useLocalSearchParams: () => ({ petId: "pet1", localPhoto: "" }),
}));

const mockGetDeviceRegionCode = jest.fn();

jest.mock("../src/checks/region", () => ({
  getDeviceRegionCode: () => mockGetDeviceRegionCode(),
}));

jest.mock("../src/api/care-plan-api", () => ({
  useTemplateSuggestions: jest.fn(),
  useInstantiateTemplate: jest.fn(),
}));

const mockedUseTemplateSuggestions = useTemplateSuggestions as unknown as jest.Mock;
const mockedUseInstantiateTemplate = useInstantiateTemplate as unknown as jest.Mock;
const mockRefetch = jest.fn();
const mockMutateAsync = jest.fn();

/** Maps a real resolved pack to the wizard's `CareTemplateSuggestions` shape. */
function buildSuggestions(
  species: "DOG" | "CAT",
  ageMonths: number | null,
  countryCode: string | undefined,
  alreadyExistsKeys: string[] = [],
): CareTemplateSuggestions {
  const pack = resolveCareTemplateForPet({ species, ageMonths, countryCode: countryCode ?? null });
  return {
    species: pack.species,
    lifeStage: pack.lifeStage,
    group: pack.group,
    items: pack.items.map((item) => ({
      templateKey: item.id,
      title: item.title,
      note: item.note,
      reminderType: item.reminderType,
      defaultStartAt: "2026-08-01T09:00:00.000Z",
      emphasis: item.emphasis,
      alreadyExists: alreadyExistsKeys.includes(item.id),
    })),
  };
}

const DOG_PUPPY_IN = buildSuggestions("DOG", 3, "IN");
const CAT_ADULT_DEFAULT = buildSuggestions("CAT", 24, undefined);

function mockSuggestions(overrides: Partial<ReturnType<typeof mockedUseTemplateSuggestions>> = {}) {
  mockedUseTemplateSuggestions.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: mockRefetch,
    ...overrides,
  });
}

describe("care plan wizard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDeviceRegionCode.mockReturnValue("IN");
    mockedUseInstantiateTemplate.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });
    mockMutateAsync.mockResolvedValue({ created: [], skipped: 0 });
  });

  afterEach(async () => {
    await act(() => {
      setOnline(true);
    });
  });

  it("loading: shows care-plan-loading", async () => {
    mockSuggestions({ isLoading: true });

    await render(<CarePlanWizardScreen />);

    expect(screen.getByTestId("care-plan-loading")).toBeTruthy();
  });

  it("error: shows care-plan-error; retry calls refetch once", async () => {
    mockSuggestions({ isError: true });

    await render(<CarePlanWizardScreen />);

    expect(screen.getByTestId("care-plan-error")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("care-plan-retry"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("empty: no items -> shows care-plan-empty; Skip navigates to pet home", async () => {
    mockSuggestions({ data: { species: "DOG", lifeStage: "ADULT", group: "DEFAULT", items: [] } });

    await render(<CarePlanWizardScreen />);

    expect(screen.getByTestId("care-plan-empty")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("care-plan-skip"));
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/pets/[id]",
      params: { id: "pet1", localPhoto: "" },
    });
  });

  it("offline with no cached data: shows care-plan-offline; retry calls refetch", async () => {
    mockSuggestions({ data: undefined });
    setOnline(false);

    await render(<CarePlanWizardScreen />);

    expect(screen.getByTestId("care-plan-offline")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("care-plan-retry"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("offline with cached data: renders the list plus care-plan-offline-banner", async () => {
    mockSuggestions({ data: DOG_PUPPY_IN });
    setOnline(false);

    await render(<CarePlanWizardScreen />);

    expect(screen.getByTestId("care-plan-offline-banner")).toBeTruthy();
    expect(screen.getAllByTestId(/^care-plan-item-/).length).toBe(DOG_PUPPY_IN.items.length);
  });

  describe.each([
    ["DOG / PUPPY_KITTEN / IN", DOG_PUPPY_IN],
    ["CAT / ADULT / DEFAULT", CAT_ADULT_DEFAULT],
  ] as const)("[AC1] %s fixture", (_label, fixture) => {
    it("renders exactly one care-plan-item row per resolved pack item, titles/ids matching", async () => {
      mockSuggestions({ data: fixture });

      await render(<CarePlanWizardScreen />);

      const rows = screen.getAllByTestId(/^care-plan-item-/);
      expect(rows).toHaveLength(fixture.items.length);

      for (const item of fixture.items) {
        expect(screen.getByTestId(`care-plan-item-${item.templateKey}`)).toBeTruthy();
        expect(screen.getByText(item.title)).toBeTruthy();
      }
    });

    it("[AC2] every rendered row shows its vet-confirm note (non-vacuous: count matches item count)", async () => {
      mockSuggestions({ data: fixture });

      await render(<CarePlanWizardScreen />);

      const noteNodes = screen.getAllByTestId(/^care-plan-note-/);
      expect(noteNodes).toHaveLength(fixture.items.length);

      for (const item of fixture.items) {
        const note = screen.getByTestId(`care-plan-note-${item.templateKey}`);
        expect(note.props.children).toContain(VET_CONFIRM_SENTENCE);
      }
    });
  });

  it("[AC1 supporting] DOG/IN fixture surfaces the emphasised rabies item", async () => {
    mockSuggestions({ data: DOG_PUPPY_IN });

    await render(<CarePlanWizardScreen />);

    const emphasisedItem = DOG_PUPPY_IN.items.find((item) => item.emphasis);
    expect(emphasisedItem).toBeDefined();
    expect(screen.getByTestId(`care-plan-emphasis-${emphasisedItem?.templateKey}`)).toBeTruthy();
  });

  it("an already-existing item is not pre-enabled and shows the already-added badge", async () => {
    const firstKey = DOG_PUPPY_IN.items[0]?.templateKey;
    if (firstKey === undefined) throw new Error("fixture has no items");
    const fixture = buildSuggestions("DOG", 3, "IN", [firstKey]);
    mockSuggestions({ data: fixture });

    await render(<CarePlanWizardScreen />);

    expect(screen.getByTestId(`care-plan-already-exists-${firstKey}`)).toBeTruthy();
    expect(screen.getByTestId(`care-plan-toggle-${firstKey}`).props.value).toBe(false);
  });

  it("toggling a row off then Confirm excludes that templateKey from selections", async () => {
    mockSuggestions({ data: DOG_PUPPY_IN });

    await render(<CarePlanWizardScreen />);

    const excludedKey = DOG_PUPPY_IN.items[0]?.templateKey;
    if (excludedKey === undefined) throw new Error("fixture has no items");
    await fireEvent(screen.getByTestId(`care-plan-toggle-${excludedKey}`), "valueChange", false);
    await fireEvent.press(screen.getByTestId("care-plan-confirm"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });
    const call = mockMutateAsync.mock.calls[0]?.[0] as { selections: Array<{ templateKey: string }> };
    expect(call.selections.some((s) => s.templateKey === excludedKey)).toBe(false);
  });

  it("editing a row's date (+1d) then Confirm sends the shifted startAt", async () => {
    mockSuggestions({ data: DOG_PUPPY_IN });

    await render(<CarePlanWizardScreen />);

    const targetKey = DOG_PUPPY_IN.items[0]?.templateKey;
    if (targetKey === undefined) throw new Error("fixture has no items");
    await fireEvent.press(screen.getByTestId(`care-plan-stepper-${targetKey}-plus1d`));
    await fireEvent.press(screen.getByTestId("care-plan-confirm"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });
    const call = mockMutateAsync.mock.calls[0]?.[0] as { selections: Array<{ templateKey: string; startAt: string }> };
    const targetSelection = call.selections.find((s) => s.templateKey === targetKey);
    expect(targetSelection?.startAt).toBe("2026-08-02T09:00:00.000Z");
  });

  it("Confirm success navigates to /pets/[id]", async () => {
    mockSuggestions({ data: DOG_PUPPY_IN });

    await render(<CarePlanWizardScreen />);
    await fireEvent.press(screen.getByTestId("care-plan-confirm"));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: "/pets/[id]",
        params: { id: "pet1", localPhoto: "" },
      });
    });
  });

  it("Skip navigates to /pets/[id]", async () => {
    mockSuggestions({ data: DOG_PUPPY_IN });

    await render(<CarePlanWizardScreen />);
    await fireEvent.press(screen.getByTestId("care-plan-skip"));

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/pets/[id]",
      params: { id: "pet1", localPhoto: "" },
    });
  });

  it("a mutation rejection surfaces care-plan-confirm-error without crashing", async () => {
    mockSuggestions({ data: DOG_PUPPY_IN });
    mockMutateAsync.mockRejectedValue(new Error("network down"));

    await render(<CarePlanWizardScreen />);
    await fireEvent.press(screen.getByTestId("care-plan-confirm"));

    await waitFor(() => {
      expect(screen.getByTestId("care-plan-confirm-error")).toBeTruthy();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
