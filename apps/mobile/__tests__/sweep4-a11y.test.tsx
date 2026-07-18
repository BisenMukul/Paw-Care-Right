import { setOnline } from "@pawcareright/api-client";
import { petIdSchema, type Pet } from "@pawcareright/types";
import { act, fireEvent, render, screen, type RenderResult } from "@testing-library/react-native";

import CareScreen from "../app/(tabs)/care";
import SettingsScreen from "../app/(tabs)/settings";
import TimelineScreen from "../app/(tabs)/timeline";
import ActivityScreen from "../app/activity/[petId]";
import CarePlanWizardScreen from "../app/care-plan/[petId]";
import ComingSoonScreen from "../app/coming-soon";
import FamilyScreen from "../app/family";
import NoteScreen from "../app/note/[petId]";
import ReminderEditScreen from "../app/reminders/edit";
import NotificationPrefsScreen from "../app/settings/notifications";
import VetVisitScreen from "../app/vet-visit/[petId]";
import WeightScreen from "../app/weight/[petId]";
import { useActivePetStore } from "../src/pets/active-pet-store";
import { strings } from "../src/strings";

/**
 * SWEEP-4 plan — cross-screen design-system.md §6 coverage for every
 * remaining screen this batch swept: page-contract (solid `bg-brand-50`,
 * no gradient), header canon, four-data-states/PTR, canon EmptyState,
 * button hierarchy, and 44pt touch targets. Mirrors SWEEP-2's `auth-
 * onboarding-a11y.test.tsx` / SWEEP-3's `check-flow-a11y.test.tsx` idiom
 * (local JSON-tree search helpers, no third-party a11y matcher).
 * Presentation-only evidence: it never asserts on store/api/router
 * behavior, which the existing per-screen behavioral suites already cover
 * and which this sweep keeps green unchanged.
 */
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));

const mockUseAgenda = jest.fn();
const mockUseCompleteOccurrence = jest.fn();
const mockUseSnoozeOccurrence = jest.fn();
jest.mock("../src/api/agenda-api", () => ({
  useAgenda: (...args: unknown[]) => mockUseAgenda(...args),
  useCompleteOccurrence: () => mockUseCompleteOccurrence(),
  useSnoozeOccurrence: () => mockUseSnoozeOccurrence(),
}));

const mockUsePets = jest.fn();
const mockUsePet = jest.fn();
jest.mock("../src/api/pets-api", () => ({
  usePets: () => mockUsePets(),
  usePet: (id: string) => mockUsePet(id),
}));

const mockUseHealthTimeline = jest.fn();
const mockUsePrepareVetSummary = jest.fn();
const mockUseWeightSeries = jest.fn();
const mockUseAddWeight = jest.fn();
const mockUseAddNote = jest.fn();
const mockUseAddActivity = jest.fn();
const mockUseAddVetVisit = jest.fn();
jest.mock("../src/api/health-logs-api", () => ({
  useHealthTimeline: (...args: unknown[]) => mockUseHealthTimeline(...args),
  usePrepareVetSummary: (...args: unknown[]) => mockUsePrepareVetSummary(...args),
  useWeightSeries: (...args: unknown[]) => mockUseWeightSeries(...args),
  useAddWeight: (...args: unknown[]) => mockUseAddWeight(...args),
  useAddNote: (...args: unknown[]) => mockUseAddNote(...args),
  useAddActivity: (...args: unknown[]) => mockUseAddActivity(...args),
  useAddVetVisit: (...args: unknown[]) => mockUseAddVetVisit(...args),
}));

jest.mock("../src/components/health-log-photo-picker", () => ({
  HealthLogPhotoPicker: () => null,
}));

const mockUseEntitlement = jest.fn();
jest.mock("../src/api/billing-api", () => ({
  useEntitlement: () => mockUseEntitlement(),
}));

jest.mock("../src/billing/purchases", () => ({
  restorePurchases: jest.fn().mockResolvedValue({ status: "error" }),
}));

jest.mock("../src/billing/manage-subscription", () => ({
  openManageSubscription: jest.fn(),
}));

const mockUseHouseholdMe = jest.fn();
const mockUseCreateInvite = jest.fn();
const mockUseLeaveHousehold = jest.fn();
jest.mock("../src/api/households-api", () => ({
  useHouseholdMe: () => mockUseHouseholdMe(),
  useCreateInvite: () => mockUseCreateInvite(),
  useLeaveHousehold: () => mockUseLeaveHousehold(),
}));

const mockUseTemplateSuggestions = jest.fn();
const mockUseInstantiateTemplate = jest.fn();
jest.mock("../src/api/care-plan-api", () => ({
  useTemplateSuggestions: (...args: unknown[]) => mockUseTemplateSuggestions(...args),
  useInstantiateTemplate: (...args: unknown[]) => mockUseInstantiateTemplate(...args),
}));

jest.mock("../src/checks/region", () => ({
  getDeviceRegionCode: () => "US",
}));

const mockUseReminder = jest.fn();
const mockUseCreateReminder = jest.fn();
const mockUseUpdateReminder = jest.fn();
const mockUseCreateMedicationCourse = jest.fn();
jest.mock("../src/api/reminders-api", () => ({
  useReminder: (...args: unknown[]) => mockUseReminder(...args),
  useCreateReminder: (...args: unknown[]) => mockUseCreateReminder(...args),
  useUpdateReminder: (...args: unknown[]) => mockUseUpdateReminder(...args),
  useCreateMedicationCourse: (...args: unknown[]) => mockUseCreateMedicationCourse(...args),
}));

const mockUseWeightUnit = jest.fn();
jest.mock("../src/weight/weight-unit-store", () => ({
  useWeightUnit: () => mockUseWeightUnit(),
}));

const mockUseNotificationPrefs = jest.fn();
const mockUseUpdateNotificationPrefs = jest.fn();
jest.mock("../src/api/notification-prefs-api", () => ({
  useNotificationPrefs: () => mockUseNotificationPrefs(),
  useUpdateNotificationPrefs: () => mockUseUpdateNotificationPrefs(),
}));

type JsonNode = ReturnType<RenderResult["toJSON"]>;

/** Recursively searches a rendered JSON tree for a node whose `className`
 * (string prop, as NativeWind passes it through unresolved under this
 * workspace's jest setup) matches `predicate` (SWEEP-2/3 precedent). */
function findClassName(
  node: JsonNode | JsonNode[] | string | null | undefined,
  predicate: (className: string) => boolean,
): boolean {
  if (node == null || typeof node === "string") {
    return false;
  }
  if (Array.isArray(node)) {
    return node.some((child) => findClassName(child, predicate));
  }
  const className = (node.props as { className?: unknown } | undefined)?.className;
  if (typeof className === "string" && predicate(className)) {
    return true;
  }
  return findClassName(node.children as JsonNode[] | null, predicate);
}

/** Recursively searches for a node of the given host-component `type`. */
function findType(node: JsonNode | JsonNode[] | string | null | undefined, type: string): boolean {
  if (node == null || typeof node === "string") {
    return false;
  }
  if (Array.isArray(node)) {
    return node.some((child) => findType(child, type));
  }
  if (node.type === type) {
    return true;
  }
  return findType(node.children as JsonNode[] | null, type);
}

const FIXTURE_PET: Pet = {
  id: petIdSchema.parse("11111111-1111-4111-8111-111111111111"),
  householdId: "22222222-2222-2222-2222-222222222222",
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

function page(items: unknown[] = [], nextCursor: string | null = null) {
  return { data: { pages: [{ items, nextCursor }], pageParams: [undefined] } };
}

describe("sweep4-a11y", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
    useActivePetStore.getState().clear();

    mockUseAgenda.mockReturnValue({ data: { entries: [] }, isLoading: false, isError: false, isRefetching: false, refetch: jest.fn() });
    mockUseCompleteOccurrence.mockReturnValue({ mutateAsync: jest.fn() });
    mockUseSnoozeOccurrence.mockReturnValue({ mutateAsync: jest.fn() });
    mockUsePets.mockReturnValue({ data: [] });
    mockUsePet.mockReturnValue({ data: FIXTURE_PET, isLoading: false, isError: false, refetch: jest.fn() });
    mockUseHealthTimeline.mockReturnValue({
      ...page([]),
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isFetchingNextPage: false,
    });
    mockUsePrepareVetSummary.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseWeightSeries.mockReturnValue({ data: { points: [] } });
    mockUseAddWeight.mockReturnValue({ mutate: jest.fn(), isPending: false });
    mockUseAddNote.mockReturnValue({ mutate: jest.fn(), isPending: false });
    mockUseAddActivity.mockReturnValue({ mutate: jest.fn(), isPending: false });
    mockUseAddVetVisit.mockReturnValue({ mutate: jest.fn(), isPending: false });
    mockUseEntitlement.mockReturnValue({ data: undefined });
    mockUseHouseholdMe.mockReturnValue({
      data: { id: "h1", name: "House", members: [] },
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    });
    mockUseCreateInvite.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseLeaveHousehold.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseTemplateSuggestions.mockReturnValue({
      data: { species: "DOG", lifeStage: "ADULT", group: "DEFAULT", items: [] },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    mockUseInstantiateTemplate.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseReminder.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: jest.fn() });
    mockUseCreateReminder.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseUpdateReminder.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseCreateMedicationCourse.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseWeightUnit.mockReturnValue({ unit: "kg", toggle: jest.fn() });
    mockUseNotificationPrefs.mockReturnValue({
      data: { disabledTypes: [], quietHours: null },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    mockUseUpdateNotificationPrefs.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
  });

  afterEach(async () => {
    await act(() => {
      setOnline(true);
    });
    useActivePetStore.getState().clear();
  });

  describe("care tab (agenda)", () => {
    it("is bg-brand-50 (no gradient), header is role=header, PTR is wired, empty is a canon EmptyState", async () => {
      const { toJSON } = await render(<CareScreen />);

      expect(findClassName(toJSON(), (c) => c.includes("bg-brand-50"))).toBe(true);
      expect(screen.queryByTestId("home-gradient-background")).toBeNull();

      const title = screen.getByText(strings.agenda.title);
      expect(title.props.accessibilityRole).toBe("header");

      const scroll = screen.getByTestId("agenda-scroll");
      expect(scroll.props.refreshControl).toBeTruthy();

      const empty = screen.getByTestId("agenda-empty");
      expect(empty).toHaveTextContent(strings.agenda.empty, { exact: false });
    });

    it("offline banner carries accessibilityRole=alert", async () => {
      mockUseAgenda.mockReturnValue({
        data: { entries: [] },
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
      });
      await act(async () => {
        setOnline(false);
      });

      await render(<CareScreen />);

      expect(screen.getByTestId("agenda-offline-banner").props.accessibilityRole).toBe("alert");
    });

    it("an agenda row's actions are a PrimaryButton (complete) + SecondaryButton (snooze)", async () => {
      const entry = {
        reminderId: "r1",
        petId: FIXTURE_PET.id,
        type: "VACCINE",
        title: "Rabies booster",
        dueAt: new Date(Date.now() + 3600_000).toISOString(),
        status: "SCHEDULED" as const,
        virtual: true,
      };
      mockUseAgenda.mockReturnValue({
        data: { entries: [entry] },
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
      });

      await render(<CareScreen />);

      const dueAtMs = new Date(entry.dueAt).getTime();
      const complete = screen.getByTestId(`agenda-item-complete-${entry.reminderId}-${dueAtMs}`);
      expect(complete.props.className).toContain("bg-brand-700");

      const snooze = screen.getByTestId(`agenda-item-snooze-${entry.reminderId}-${dueAtMs}`);
      expect(snooze.props.className).toContain("border-brand-700");
      expect(snooze.props.className).toContain("bg-white");
    });
  });

  describe("timeline tab", () => {
    it("is bg-brand-50, header is role=header capped at 1.5x, PTR wired on the list, empty is EmptyState", async () => {
      useActivePetStore.getState().setActivePet(FIXTURE_PET.id);

      const { toJSON } = await render(<TimelineScreen />);

      expect(findClassName(toJSON(), (c) => c.includes("bg-brand-50"))).toBe(true);

      const title = screen.getByText(strings.timeline.title);
      expect(title.props.accessibilityRole).toBe("header");
      expect(title.props.maxFontSizeMultiplier).toBe(1.5);

      const list = screen.getByTestId("timeline-list");
      expect(list.props.refreshControl).toBeTruthy();

      const empty = screen.getByTestId("timeline-empty");
      expect(empty).toHaveTextContent(strings.timeline.empty, { exact: false });
    });

    it("offline banner carries accessibilityRole=alert", async () => {
      useActivePetStore.getState().setActivePet(FIXTURE_PET.id);
      await act(async () => {
        setOnline(false);
      });

      await render(<TimelineScreen />);

      expect(screen.getByTestId("timeline-offline-banner").props.accessibilityRole).toBe("alert");
    });
  });

  describe("settings tab", () => {
    it("is bg-brand-50, title is role=header, nav rows are Pressable ListRows", async () => {
      const { toJSON } = await render(<SettingsScreen />);

      expect(findClassName(toJSON(), (c) => c.includes("bg-brand-50"))).toBe(true);

      const title = screen.getByText(strings.settings.title);
      expect(title.props.accessibilityRole).toBe("header");

      const family = screen.getByTestId("settings-family");
      expect(family.props.accessibilityRole).toBe("button");
      const notifications = screen.getByTestId("settings-notifications");
      expect(notifications.props.accessibilityRole).toBe("button");
    });
  });

  describe("family screen", () => {
    it("is bg-brand-50, title is role=header, PTR wired, empty is EmptyState", async () => {
      mockUseHouseholdMe.mockReturnValue({ data: undefined, isLoading: false, isError: false, isRefetching: false, refetch: jest.fn() });

      const { toJSON } = await render(<FamilyScreen />);

      expect(findClassName(toJSON(), (c) => c.includes("bg-brand-50"))).toBe(true);
      const empty = screen.getByTestId("family-empty");
      expect(empty).toHaveTextContent(strings.family.empty, { exact: false });
    });

    it("loaded: title is a header and PTR is wired on the scroll", async () => {
      const { toJSON } = await render(<FamilyScreen />);

      expect(findClassName(toJSON(), (c) => c.includes("bg-brand-50"))).toBe(true);
      const title = screen.getByText(strings.family.title);
      expect(title.props.accessibilityRole).toBe("header");

      const scroll = screen.getByTestId("family-scroll");
      expect(scroll.props.refreshControl).toBeTruthy();
    });
  });

  describe("care-plan wizard", () => {
    it("empty is a canon EmptyState with a CTA (Skip, reusing goToPetHome)", async () => {
      mockParams = { petId: "pet1" };

      await render(<CarePlanWizardScreen />);

      const empty = screen.getByTestId("care-plan-empty");
      expect(empty).toHaveTextContent(strings.carePlan.empty, { exact: false });

      const skip = screen.getByTestId("care-plan-skip");
      expect(skip.props.accessibilityRole).toBe("button");
      await fireEvent.press(skip);
      expect(mockReplace).toHaveBeenCalledWith({ pathname: "/pets/[id]", params: { id: "pet1", localPhoto: "" } });
    });

    it("loaded: title is a header and a date stepper reaches the 44pt touch target", async () => {
      mockParams = { petId: "pet1" };
      mockUseTemplateSuggestions.mockReturnValue({
        data: {
          species: "DOG",
          lifeStage: "ADULT",
          group: "DEFAULT",
          items: [
            {
              templateKey: "rabies",
              title: "Rabies booster",
              note: "Confirm with your vet.",
              reminderType: "VACCINE",
              defaultStartAt: "2026-08-01T09:00:00.000Z",
              emphasis: false,
              alreadyExists: false,
            },
          ],
        },
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      });

      await render(<CarePlanWizardScreen />);

      const title = screen.getByText(strings.carePlan.title);
      expect(title.props.accessibilityRole).toBe("header");

      const stepper = screen.getByTestId("care-plan-stepper-rabies-plus1d");
      expect(stepper.props.className).toContain("min-h-[44px]");
      expect(stepper.props.accessibilityRole).toBeUndefined();
    });
  });

  describe("reminder create/edit screen", () => {
    it("title is a header and a start-date stepper reaches the 44pt touch target", async () => {
      mockParams = { petId: "pet-a" };

      await render(<ReminderEditScreen />);

      const title = screen.getByText(strings.reminderForm.createTitle);
      expect(title.props.accessibilityRole).toBe("header");

      const stepper = screen.getByTestId("reminder-startdate-plus1d");
      expect(stepper.props.className).toContain("min-h-[44px]");
    });
  });

  describe("weight screen", () => {
    it("is bg-brand-50 and title is a header", async () => {
      mockParams = { petId: "pet1" };

      const { toJSON } = await render(<WeightScreen />);

      expect(findClassName(toJSON(), (c) => c.includes("bg-brand-50"))).toBe(true);
      const title = screen.getByText(strings.weight.title);
      expect(title.props.accessibilityRole).toBe("header");
    });

    it("add-weight-form's error is accessibilityRole=alert once shown", async () => {
      mockParams = { petId: "pet1" };

      await render(<WeightScreen />);
      await fireEvent.press(screen.getByTestId("weight-add-button"));
      await fireEvent.press(screen.getByTestId("add-weight-save"));

      const error = screen.getByTestId("add-weight-error");
      expect(error.props.accessibilityRole).toBe("alert");
      expect(error.props.className).toContain("text-red-700");
    });
  });

  describe("note screen", () => {
    it("is bg-brand-50, title is a header, and the form's error is accessibilityRole=alert", async () => {
      mockParams = { petId: "pet1" };

      const { toJSON } = await render(<NoteScreen />);

      expect(findClassName(toJSON(), (c) => c.includes("bg-brand-50"))).toBe(true);
      const title = screen.getByText(strings.note.title);
      expect(title.props.accessibilityRole).toBe("header");

      await fireEvent.press(screen.getByTestId("add-note-save"));
      const error = screen.getByTestId("add-note-error");
      expect(error.props.accessibilityRole).toBe("alert");
      expect(error.props.className).toContain("text-red-700");
    });
  });

  describe("activity screen", () => {
    it("is bg-brand-50 and title is a header, role capped at 1.5x", async () => {
      mockParams = { petId: "pet1" };

      const { toJSON } = await render(<ActivityScreen />);

      expect(findClassName(toJSON(), (c) => c.includes("bg-brand-50"))).toBe(true);
      const title = screen.getByText(strings.activity.title);
      expect(title.props.accessibilityRole).toBe("header");
      expect(title.props.maxFontSizeMultiplier).toBe(1.5);
    });
  });

  describe("vet-visit screen", () => {
    it("is bg-brand-50, title is a header, and the reason error is accessibilityRole=alert", async () => {
      mockParams = { petId: "pet1" };

      const { toJSON } = await render(<VetVisitScreen />);

      expect(findClassName(toJSON(), (c) => c.includes("bg-brand-50"))).toBe(true);
      const title = screen.getByText(strings.vetVisit.title);
      expect(title.props.accessibilityRole).toBe("header");

      await fireEvent.press(screen.getByTestId("add-vet-visit-save"));
      const error = screen.getByTestId("add-vet-visit-error-reason");
      expect(error.props.accessibilityRole).toBe("alert");
      expect(error.props.className).toContain("text-red-700");
    });
  });

  describe("settings/notifications screen", () => {
    it("is bg-brand-50, title is a header, and the offline banner is accessibilityRole=alert", async () => {
      await act(async () => {
        setOnline(false);
      });

      const { toJSON } = await render(<NotificationPrefsScreen />);

      expect(findClassName(toJSON(), (c) => c.includes("bg-brand-50"))).toBe(true);
      const title = screen.getByText(strings.notifications.title);
      expect(title.props.accessibilityRole).toBe("header");

      expect(screen.getByTestId("notifications-offline-banner").props.accessibilityRole).toBe("alert");
    });
  });

  describe("coming-soon screen", () => {
    it("is bg-brand-50 and title is a header", async () => {
      const { toJSON } = await render(<ComingSoonScreen />);

      expect(findClassName(toJSON(), (c) => c.includes("bg-brand-50"))).toBe(true);
      const title = screen.getByText(strings.comingSoon.title);
      expect(title.props.accessibilityRole).toBe("header");
      expect(title.props.maxFontSizeMultiplier).toBe(1.5);
    });
  });

  describe("no ActivityIndicator spinners remain on swept loading states", () => {
    it("care/timeline/weight loading states render Skeleton content, not a spinner", async () => {
      mockUseAgenda.mockReturnValue({ data: undefined, isLoading: true, isError: false, isRefetching: false, refetch: jest.fn() });
      const care = await render(<CareScreen />);
      expect(screen.getByTestId("agenda-loading")).toBeTruthy();
      expect(findType(care.toJSON(), "ActivityIndicator")).toBe(false);
      care.unmount();

      mockUsePet.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: jest.fn() });
      mockParams = { petId: "pet1" };
      const weight = await render(<WeightScreen />);
      expect(screen.getByTestId("weight-screen-loading")).toBeTruthy();
      expect(findType(weight.toJSON(), "ActivityIndicator")).toBe(false);
    });
  });
});
