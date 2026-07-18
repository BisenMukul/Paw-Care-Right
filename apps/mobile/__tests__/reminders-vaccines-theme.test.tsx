import { resolveCareTemplateForPet, VET_CONFIRM_SENTENCE } from "@pawcareright/data";
import type { CareTemplateSuggestions } from "@pawcareright/types";
import { render, screen } from "@testing-library/react-native";

import CarePlanWizardScreen from "../app/care-plan/[petId]";
import ReminderEditScreen from "../app/reminders/edit";
import { useInstantiateTemplate, useTemplateSuggestions } from "../src/api/care-plan-api";
import {
  useCreateMedicationCourse,
  useCreateReminder,
  useReminder,
  useUpdateReminder,
} from "../src/api/reminders-api";
import { strings } from "../src/strings";

/**
 * PAWSAATHI-2 plan (scope 3 "Tests to write"): reuses `care-plan-
 * wizard.test.tsx`'s fixture-building pattern (a real resolved template pack
 * mapped to the wizard's shape) and `reminder-edit.test.tsx`'s hook-mocking
 * convention. Asserts the dark-mode restyle landed (dark: tokens present)
 * WITHOUT touching any frozen content: the care-plan `item.note` stays
 * byte-verbatim from the fixture, and the generic reminder form still
 * carries zero dose/drug copy (med SSOT byte-frozen, CLAUDE §7 rule 2).
 */
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ petId: "pet1", localPhoto: "" }),
}));

jest.mock("../src/checks/region", () => ({
  getDeviceRegionCode: () => "IN",
}));

jest.mock("../src/api/care-plan-api", () => ({
  useTemplateSuggestions: jest.fn(),
  useInstantiateTemplate: jest.fn(),
}));

jest.mock("../src/api/reminders-api", () => ({
  useReminder: jest.fn(),
  useCreateReminder: jest.fn(),
  useUpdateReminder: jest.fn(),
  useCreateMedicationCourse: jest.fn(),
}));

const mockedUseTemplateSuggestions = useTemplateSuggestions as unknown as jest.Mock;
const mockedUseInstantiateTemplate = useInstantiateTemplate as unknown as jest.Mock;
const mockedUseReminder = useReminder as unknown as jest.Mock;
const mockedUseCreateReminder = useCreateReminder as unknown as jest.Mock;
const mockedUseUpdateReminder = useUpdateReminder as unknown as jest.Mock;
const mockedUseCreateMedicationCourse = useCreateMedicationCourse as unknown as jest.Mock;

function buildSuggestions(): CareTemplateSuggestions {
  const pack = resolveCareTemplateForPet({ species: "DOG", ageMonths: 3, countryCode: "IN" });
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
      alreadyExists: false,
    })),
  };
}

const FIXTURE = buildSuggestions();

describe("care-plan wizard: PAWSAATHI-2 dark restyle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseTemplateSuggestions.mockReturnValue({
      data: FIXTURE,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    mockedUseInstantiateTemplate.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
  });

  it("an item heading + note carry dark variants, and the note text is byte-verbatim from the fixture", async () => {
    await render(<CarePlanWizardScreen />);

    const firstItem = FIXTURE.items[0];
    if (firstItem === undefined) {
      throw new Error("fixture must have at least one item");
    }

    expect(screen.getByText(firstItem.title).props.className).toContain("dark:text-ink-dark");

    const noteNode = screen.getByTestId(`care-plan-note-${firstItem.templateKey}`);
    expect(noteNode.props.className).toContain("dark:text-ink-muted-dark");
    expect(noteNode.props.children).toBe(firstItem.note);
    expect(firstItem.note).toContain(VET_CONFIRM_SENTENCE);
  });
});

describe("reminder edit (CREATE mode): PAWSAATHI-2 dark restyle, no dose/drug copy on the generic form", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseReminder.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: jest.fn() });
    mockedUseCreateReminder.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockedUseUpdateReminder.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockedUseCreateMedicationCourse.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
  });

  it("a group heading carries dark:text-ink-dark; the generic form renders NO dose/drug string", async () => {
    await render(<ReminderEditScreen />);

    expect(screen.getByText(strings.reminderForm.typeHeading).props.className).toContain("dark:text-ink-dark");

    const rendered = JSON.stringify(screen.toJSON());
    expect(rendered).not.toMatch(/dose/i);
    expect(rendered).not.toMatch(/drug/i);
  });
});
