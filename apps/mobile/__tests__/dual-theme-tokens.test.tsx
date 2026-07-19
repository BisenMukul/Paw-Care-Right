import type { AgendaEntry, CheckResponse } from "@pawcareright/types";
import { petIdSchema, type Pet } from "@pawcareright/types";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";

import type { TimelineItem } from "../src/api/health-logs-api";
import { AgendaItem } from "../src/components/agenda-item";
import { ActivityChipGrid } from "../src/components/activity-chip-grid";
import { AddNoteForm } from "../src/components/add-note-form";
import { AppTitle } from "../src/components/app-title";
import { Card } from "../src/components/card";
import { CategoryGrid } from "../src/components/category-grid";
import { CareScoreCard } from "../src/components/home/care-score-card";
import { CheckHistoryRow } from "../src/components/check-history-row";
import { getCategoryLabel } from "../src/checks/check-history";
import { Chip } from "../src/components/chip";
import { EmptyState } from "../src/components/empty-state";
import { GhostButton } from "../src/components/ghost-button";
import { AnimatedGradientBackground } from "../src/components/home/animated-gradient-background";
import { EmptyHomeState } from "../src/components/home/empty-home-state";
import { HomeHeader } from "../src/components/home/home-header";
import { PetHeroCard } from "../src/components/home/pet-hero-card";
import { QuickActionsGrid } from "../src/components/home/quick-actions-grid";
import { TodayPreviewCard } from "../src/components/home/today-preview-card";
import { ListRow } from "../src/components/list-row";
import { OtpInput } from "../src/components/otp-input";
import { PetHeaderCard } from "../src/components/pet-header-card";
import { PetSwitcher } from "../src/components/pet-switcher";
import { PrimaryButton } from "../src/components/primary-button";
import { QuickActions } from "../src/components/quick-actions";
import { SaveConfirmation } from "../src/components/save-confirmation";
import { ScreenScaffold } from "../src/components/screen-scaffold";
import { SecondaryButton } from "../src/components/secondary-button";
import { SectionHeader } from "../src/components/section-header";
import { Skeleton } from "../src/components/skeleton";
import { SpeciesPicker } from "../src/components/species-picker";
import { TextField } from "../src/components/text-field";
import { TimelineRow } from "../src/components/timeline-row";
import { UpsellSheet } from "../src/components/upsell-sheet";
import { WizardScaffold } from "../src/components/wizard-scaffold";
import { useUpsellStore } from "../src/billing/upsell-store";
import { usePet, usePets } from "../src/api/pets-api";
import { strings } from "../src/strings";

/**
 * PAWSAATHI-1 plan Risk R3: under NativeWind 4.2.6 + jest-expo's `.css`
 * stub, `className` stays a literal string prop that is NEVER resolved to
 * styles, and the full base+`dark:` string is present regardless of the OS
 * color scheme -- a scheme flip is not observable in the rendered tree via
 * `className`. The definitive, established assertion (mirrors
 * `touch-targets.test.tsx`/`chip.test.tsx`) is therefore className-CONTENT:
 * every dual-themed canon/home component's className includes BOTH its
 * light base class AND its new `dark:` variant.
 */

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const mockUseAgenda = jest.fn();
jest.mock("../src/api/agenda-api", () => ({
  useAgenda: (...args: unknown[]) => mockUseAgenda(...args),
}));

jest.mock("../src/api/pets-api", () => ({
  usePets: jest.fn(),
  usePet: jest.fn(),
}));

const mockedUsePetsForSwitcher = usePets as unknown as jest.Mock;
const mockedUsePetForSwitcher = usePet as unknown as jest.Mock;

jest.mock("../src/billing/upsell-store", () => ({
  useUpsellStore: jest.fn(),
}));

const mockedUseUpsellStore = useUpsellStore as unknown as jest.Mock;

const FIXTURE_PET: Pet = {
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

describe("dual-theme-tokens: canon components carry base + dark: variants", () => {
  it("Card: bg-white + dark:bg-surface-card-dark", async () => {
    await render(
      <Card testID="c">
        <Text>x</Text>
      </Card>,
    );
    const className = screen.getByTestId("c").props.className as string;
    expect(className).toContain("bg-white");
    expect(className).toContain("dark:bg-surface-card-dark");
  });

  it("PrimaryButton: enabled fill bg-brand-700 + dark:bg-accent-dark, label font-body-semibold", async () => {
    await render(<PrimaryButton testID="pb" label="Save" onPress={jest.fn()} />);
    expect(screen.getByTestId("pb").props.className).toContain("dark:bg-accent-dark");
    expect(screen.getByText("Save").props.className).toContain("font-body-semibold");
  });

  it("PrimaryButton: disabled fill bg-brand-300 + dark:bg-surface-raised-dark", async () => {
    await render(<PrimaryButton testID="pb" label="Save" onPress={jest.fn()} disabled />);
    const className = screen.getByTestId("pb").props.className as string;
    expect(className).toContain("bg-brand-300");
    expect(className).toContain("dark:bg-surface-raised-dark");
  });

  it("SecondaryButton: border-brand-700/bg-white + dark:border-accent-bright/dark:bg-surface-card-dark", async () => {
    await render(<SecondaryButton testID="sb" label="Cancel" onPress={jest.fn()} />);
    const className = screen.getByTestId("sb").props.className as string;
    expect(className).toContain("border-brand-700");
    expect(className).toContain("dark:border-accent-bright");
    expect(className).toContain("dark:bg-surface-card-dark");
    expect(screen.getByText("Cancel").props.className).toContain("dark:text-accent-bright");
  });

  it("GhostButton: label text-brand-700 + dark:text-accent-bright", async () => {
    await render(<GhostButton label="Skip" onPress={jest.fn()} />);
    const className = screen.getByText("Skip").props.className as string;
    expect(className).toContain("text-brand-700");
    expect(className).toContain("dark:text-accent-bright");
  });

  it("Chip: selected bg-brand-700 + dark:bg-accent-dark, unselected bg-white + dark:bg-surface-card-dark, min-h-[44px] retained", async () => {
    await render(<Chip testID="chip-sel" label="Dogs" selected onPress={jest.fn()} />);
    const selectedClassName = screen.getByTestId("chip-sel").props.className as string;
    expect(selectedClassName).toContain("bg-brand-700");
    expect(selectedClassName).toContain("dark:bg-accent-dark");
    expect(selectedClassName).toContain("min-h-[44px]");

    await render(<Chip testID="chip-unsel" label="Cats" selected={false} onPress={jest.fn()} />);
    const unselectedClassName = screen.getByTestId("chip-unsel").props.className as string;
    expect(unselectedClassName).toContain("bg-white");
    expect(unselectedClassName).toContain("dark:bg-surface-card-dark");
    expect(unselectedClassName).toContain("dark:border-hairline-dark");
    expect(unselectedClassName).toContain("min-h-[44px]");
  });

  it("ListRow: leading circle + title + subtitle carry dark variants", async () => {
    await render(<ListRow testID="row" title="Family" subtitle="Manage" leadingIcon="people-outline" />);
    expect(screen.getByText("Family").props.className).toContain("dark:text-ink-dark");
    expect(screen.getByText("Manage").props.className).toContain("dark:text-ink-muted-dark");
  });

  it("EmptyState: container + title + body carry dark variants", async () => {
    await render(<EmptyState testID="empty" icon="paw-outline" title="Nothing" body="Check back" />);
    expect(screen.getByTestId("empty").props.className).toContain("dark:bg-surface-card-dark");
    expect(screen.getByText("Nothing").props.className).toContain("dark:text-ink-dark");
    expect(screen.getByText("Check back").props.className).toContain("dark:text-ink-muted-dark");
  });

  it("Skeleton: bones carry dark:bg-surface-raised-dark", async () => {
    await render(<Skeleton testID="sk" lines={1} />);
    expect(screen.getByTestId("sk-bone-0").props.className).toContain("dark:bg-surface-raised-dark");
  });

  it("TextField: input + label carry dark variants", async () => {
    await render(<TextField testID="tf" label="Email" value="" onChangeText={jest.fn()} />);
    expect(screen.getByTestId("tf").props.className).toContain("dark:bg-surface-card-dark");
    expect(screen.getByText("Email").props.className).toContain("dark:text-ink-dark");
  });

  it("TextField: error text is text-red-700 with a dark:text-red-400 correction (design-system.md §1.6)", async () => {
    await render(
      <TextField
        testID="tf"
        errorTestID="tf-error"
        label="Email"
        value=""
        onChangeText={jest.fn()}
        error="Required"
      />,
    );
    const className = screen.getByTestId("tf-error").props.className as string;
    expect(className).toContain("text-red-700");
    expect(className).toContain("dark:text-red-400");
  });

  it("SaveConfirmation: container + message + nudge carry dark variants", async () => {
    await render(<SaveConfirmation testID="save" message="Saved." nudge="Nice work." />);
    expect(screen.getByTestId("save").props.className).toContain("dark:bg-surface-raised-dark");
    expect(screen.getByText("Saved.").props.className).toContain("dark:text-ink-dark");
    expect(screen.getByText("Nice work.").props.className).toContain("dark:text-ink-muted-dark");
  });

  it("SectionHeader: title + action carry dark variants", async () => {
    await render(<SectionHeader title="Quick actions" actionLabel="See all" onAction={jest.fn()} />);
    expect(screen.getByText("Quick actions").props.className).toContain("dark:text-ink-dark");
    expect(screen.getByText("See all").props.className).toContain("dark:text-accent-bright");
  });

  it("ScreenScaffold: page + title + subtitle carry dark variants", async () => {
    await render(
      <ScreenScaffold title="Care" subtitle="Everything on schedule">
        <Text>child</Text>
      </ScreenScaffold>,
    );
    expect(screen.getByText("Care").props.className).toContain("dark:text-ink-dark");
    expect(screen.getByText("Everything on schedule").props.className).toContain("dark:text-ink-muted-dark");
  });
});

describe("dual-theme-tokens: home Variant A components carry base + dark: variants", () => {
  it("PetHeroCard: accent surface + white text, NO health-score/wellbeing copy (plan Risk R4)", async () => {
    await render(<PetHeroCard pet={FIXTURE_PET} onPress={jest.fn()} />);

    const card = screen.getByTestId("home-open-active-pet");
    expect(card.props.className).toContain("bg-brand-700");
    expect(card.props.className).toContain("dark:bg-accent-dark");
    expect(screen.getByTestId("home-pet-name").props.className).toContain("font-display");

    const rendered = JSON.stringify(screen.toJSON());
    expect(rendered).not.toMatch(/health score/i);
    expect(rendered).not.toMatch(/healthy/i);
  });

  it("HomeHeader: greeting carries dark:text-ink-dark, settings button carries dark:bg-surface-raised-dark", async () => {
    await render(<HomeHeader />);
    expect(screen.getByTestId("home-greeting").props.className).toContain("dark:text-ink-dark");
    expect(screen.getByTestId("home-settings-button").props.className).toContain("dark:bg-surface-raised-dark");
  });

  it("QuickActionsGrid: tiles carry dark:bg-surface-raised-dark, labels carry dark:text-ink-dark", async () => {
    await render(
      <QuickActionsGrid
        disabled={false}
        onCheckSymptoms={jest.fn()}
        onLogWeight={jest.fn()}
        onLogActivity={jest.fn()}
        onVetVisit={jest.fn()}
      />,
    );
    const tile = screen.getByTestId("home-quick-action-check");
    expect(tile.props.className).toContain("dark:bg-surface-raised-dark");
  });

  it("EmptyHomeState: container + title + body carry dark variants, no CTA-adjacent wellbeing copy", async () => {
    await render(<EmptyHomeState />);
    expect(screen.getByTestId("home-empty-state").props.className).toContain("dark:bg-surface-card-dark");
  });

  it("AppTitle: dark:text-ink-dark + font-display", async () => {
    await render(<AppTitle />);
    const className = screen.getByTestId("app-title").props.className as string;
    expect(className).toContain("dark:text-ink-dark");
    expect(className).toContain("font-display");
  });

  it("AnimatedGradientBackground: still mounts the home-signature testIDs unchanged", async () => {
    await render(<AnimatedGradientBackground />);
    expect(screen.getByTestId("home-gradient-background")).toBeTruthy();
  });

  it("TodayPreviewCard: card + title + row text carry dark variants", async () => {
    mockUseAgenda.mockReturnValue({
      data: { entries: [] },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    await render(<TodayPreviewCard />);

    expect(screen.getByTestId("home-today-card").props.className).toContain("dark:bg-surface-card-dark");
    expect(screen.getByText(strings.home.todayTitle).props.className).toContain("dark:text-ink-dark");
  });
});

describe("dual-theme-tokens: PAWSAATHI-2 CARE + LOGGING screens", () => {
  const AGENDA_ENTRY_WITH_DOSE: AgendaEntry = {
    reminderId: "reminder-1",
    petId: "pet-1",
    type: "MEDICATION",
    title: "Amoxicillin course",
    dueAt: "2026-07-18T09:00:00.000Z",
    status: "SCHEDULED",
    virtual: true,
    medDoseAsEntered: "1 tablet",
  };

  it("AgendaItem: title + dose carry dark+font tokens, and the dose line content is byte-identical", async () => {
    await render(<AgendaItem entry={AGENDA_ENTRY_WITH_DOSE} onComplete={jest.fn()} onSnooze={jest.fn()} />);

    expect(screen.getByText("Amoxicillin course").props.className).toContain("dark:text-ink-dark");
    expect(screen.getByText("Amoxicillin course").props.className).toContain("font-body-semibold");

    const doseNode = screen.getByTestId(
      `agenda-item-dose-${AGENDA_ENTRY_WITH_DOSE.reminderId}-${new Date(AGENDA_ENTRY_WITH_DOSE.dueAt).getTime()}`,
    );
    expect(doseNode.props.className).toContain("dark:text-ink-muted-dark");
    expect(doseNode.props.className).toContain("font-body");
    expect(doseNode.props.children).toEqual([strings.agenda.medDoseLabel, ": ", "1 tablet"]);
  });

  const TIMELINE_NOTE_ITEM: TimelineItem = {
    id: "note-1",
    kind: "NOTE",
    occurredAt: "2026-07-10T00:00:00.000Z",
    value: { text: "Ate a bug" },
    photoKeys: [],
  };

  it("TimelineRow: card + label/date carry dark variants", async () => {
    await render(
      <TimelineRow item={TIMELINE_NOTE_ITEM} petId="pet-1" onPressCheck={jest.fn()} onOpenPhoto={jest.fn()} />,
    );

    const row = screen.getByTestId("timeline-row-note-1");
    expect(JSON.stringify(row)).toContain("dark:bg-surface-card-dark");
    expect(screen.getByText(strings.timeline.kindLabel.NOTE).props.className).toContain("dark:text-ink-dark");
    expect(screen.getByText("2026-07-10").props.className).toContain("dark:text-ink-muted-dark");
  });
});

describe("dual-theme-tokens: PAWSAATHI-3 SYMPTOM-CHECK flow", () => {
  const MONITOR_CHECK: CheckResponse = {
    id: "c1",
    status: "DONE",
    category: "vomiting",
    createdAt: "2024-01-01T00:00:00.000Z",
    result: {
      urgency: "MONITOR",
      confidence: "high",
      summary: "General guidance based on the information provided.",
      possibleCauses: [{ name: "Mild upset stomach", whyItFits: "Reported symptoms are consistent with this." }],
      redFlagsToWatch: ["Repeated vomiting"],
      homeCare: ["Offer small amounts of water"],
      doNot: ["Do not give human medications without veterinary guidance."],
      vetQuestions: ["How long have symptoms been present?"],
      followUpHours: 24,
    },
  } as unknown as CheckResponse;

  const IN_PROGRESS_CHECK: CheckResponse = {
    id: "c2",
    status: "RUNNING",
    category: "vomiting",
    createdAt: "2024-01-02T00:00:00.000Z",
  } as unknown as CheckResponse;

  it("CheckHistoryRow: row + title carry dark variants, MONITOR tier chip carries its dark:bg-blue-900/dark:text-blue-100 pair", async () => {
    await render(<CheckHistoryRow item={MONITOR_CHECK} onPress={jest.fn()} />);

    const row = screen.getByTestId("check-history-row-c1");
    expect(row.props.className).toContain("dark:border-hairline-dark");

    const title = screen.getByText(getCategoryLabel("vomiting"));
    expect(title.props.className).toContain("dark:text-ink-dark");

    const chip = screen.getByTestId("check-history-chip-c1");
    expect(chip.props.className).toContain("dark:bg-blue-900");
    const chipLabel = screen.getByText(strings.check.result.tierLabel.MONITOR);
    expect(chipLabel.props.className).toContain("dark:text-blue-100");
  });

  it("CheckHistoryRow: in-progress chip carries dark:bg-surface-card-dark", async () => {
    await render(<CheckHistoryRow item={IN_PROGRESS_CHECK} onPress={jest.fn()} />);

    const chip = screen.getByTestId("check-history-chip-c2");
    expect(chip.props.className).toContain("dark:bg-surface-card-dark");
  });

  it("CategoryGrid: tile carries dark:bg-surface-card-dark", async () => {
    await render(<CategoryGrid onSelect={jest.fn()} />);

    const tile = screen.getByTestId("check-category-vomiting");
    expect(tile.props.className).toContain("dark:bg-surface-card-dark");
  });
});

describe("dual-theme-tokens: PAWSAATHI-4 remaining screens/components", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("PetHeaderCard: card + name + chips carry dark variants", async () => {
    await render(<PetHeaderCard pet={FIXTURE_PET} />);

    expect(screen.getByTestId("pet-home-header-card").props.className).toContain("dark:bg-surface-card-dark");
    expect(screen.getByTestId("pet-home-name").props.className).toContain("dark:text-ink-dark");
    expect(screen.getByTestId("pet-home-species").props.className).toContain("dark:bg-surface-raised-dark");
  });

  it("QuickActions: tile + label carry dark variants", async () => {
    await render(
      <QuickActions onLogWeight={jest.fn()} onReminders={jest.fn()} onLogActivity={jest.fn()} onLogVetVisit={jest.fn()} />,
    );

    const tile = screen.getByTestId("quick-action-log-weight");
    expect(tile.props.className).toContain("dark:bg-surface-card-dark");
    expect(screen.getByText(strings.petHome.logWeight).props.className).toContain("dark:text-ink-dark");
  });

  it("PetSwitcher: single-pet active name carries dark variants", async () => {
    mockedUsePetsForSwitcher.mockReturnValue({ data: [FIXTURE_PET], isLoading: false, isError: false });
    mockedUsePetForSwitcher.mockReturnValue({ data: FIXTURE_PET, isLoading: false, isError: false });

    await render(<PetSwitcher />);

    expect(screen.getByTestId("pet-switcher-active-name").props.className).toContain("dark:text-ink-dark");
  });

  it("WizardScaffold: progress text carries dark variants", async () => {
    await render(
      <WizardScaffold step={1} total={5}>
        <Text>content</Text>
      </WizardScaffold>,
    );

    expect(screen.getByTestId("wizard-progress").props.className).toContain("dark:text-ink-muted-dark");
  });

  it("SpeciesPicker: selected + unselected cards carry dark variants", async () => {
    await render(<SpeciesPicker value="DOG" onChange={jest.fn()} />);

    expect(screen.getByTestId("species-card-dog").props.className).toContain("dark:border-accent-bright");
    expect(screen.getByTestId("species-card-cat").props.className).toContain("dark:border-hairline-dark");
  });

  it("OtpInput: normal + error cells carry dark variants", async () => {
    const { rerender } = await render(
      <OtpInput testID="otp" value="" onChangeText={jest.fn()} onComplete={jest.fn()} />,
    );
    expect(screen.getByTestId("otp-cell-0").props.className).toContain("dark:text-ink-dark");

    await rerender(<OtpInput testID="otp" value="" onChangeText={jest.fn()} onComplete={jest.fn()} hasError />);
    expect(screen.getByTestId("otp-cell-0").props.className).toContain("dark:text-red-400");
  });

  it("UpsellSheet: sheet + title + body carry dark variants", async () => {
    mockedUseUpsellStore.mockImplementation(
      (selector: (state: { visible: boolean; hide: () => void }) => unknown) =>
        selector({ visible: true, hide: jest.fn() }),
    );

    await render(<UpsellSheet />);

    expect(screen.getByTestId("upsell-sheet").props.className).toContain("dark:bg-surface-card-dark");
    expect(screen.getByText(strings.upsell.title).props.className).toContain("dark:text-ink-dark");
    expect(screen.getByText(strings.upsell.body).props.className).toContain("dark:text-ink-muted-dark");
  });

  it("AddNoteForm: input carries dark variants", async () => {
    await render(<AddNoteForm petId="pet-1" submitting={false} onSubmit={jest.fn()} />);

    expect(screen.getByTestId("add-note-input").props.className).toContain("dark:bg-surface-card-dark");
  });
});

describe("dual-theme-tokens: FIDELITY-2 cream page + colorful tiles + care-hub hero", () => {
  it("ScreenScaffold: page root carries bg-surface-page + dark:bg-surface-page-dark", async () => {
    const { toJSON } = await render(
      <ScreenScaffold title="Care">
        <Text>child</Text>
      </ScreenScaffold>,
    );
    const className = (toJSON() as unknown as { props: { className: string } }).props.className;
    expect(className).toContain("bg-surface-page");
    expect(className).toContain("dark:bg-surface-page-dark");
  });

  it("CategoryGrid: tile fill carries a decorative accent/category token, white icon", async () => {
    await render(<CategoryGrid onSelect={jest.fn()} />);

    const tile = screen.getByTestId("check-category-vomiting-tile");
    expect(tile.props.className).toContain("bg-accent-bright");
  });

  it("ActivityChipGrid: tile fill carries a decorative accent/category token, white icon", async () => {
    await render(<ActivityChipGrid onSelect={jest.fn()} />);

    const tile = screen.getByTestId("activity-chip-FOOD-tile");
    expect(tile.props.className).toContain("bg-accent-bright");
  });

  it("CareScoreCard: care-hub hero surface carries bg-accent-dark (same green both themes)", async () => {
    mockUseAgenda.mockReturnValue({ data: { entries: [] }, isLoading: false, isError: false });

    await render(<CareScoreCard pet={FIXTURE_PET} />);

    expect(screen.getByTestId("home-care-score-card").props.className).toContain("bg-accent-dark");
    expect(screen.getByTestId("home-care-score-cta")).toHaveTextContent(strings.careScore.runCheckCta);
  });
});

