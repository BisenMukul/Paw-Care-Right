import type { Species } from "@pawcareright/types";

import { VET_CONFIRM_SENTENCE, type CareTemplateItemInput, type LifeStage, type ProtocolGroup } from "../schema";

/**
 * Region-varying vaccine overlay (Decision R1) — only rabies (+/-
 * leptospirosis) differs by region; everything else lives in `./base.ts`.
 * Sources consulted (names only — no copied prose, no URLs): WSAVA/WHO
 * rabies endemicity guidance, ESCCAP/TROCCAP regional parasite guidance.
 * `DEFAULT` is mandatory so every resolved pack has a rabies item. Groups
 * left undefined here inherit `DEFAULT` at resolve time (see `../index.ts`).
 * Regional emphasis assignments are content the C-checkpoint veterinarian
 * review confirms (R8); the IN case is the one pinned acceptance criterion.
 */

const DEFAULT_RABIES_NOTE = "Rabies requirements and importance vary by country and local law. " + VET_CONFIRM_SENTENCE;

function defaultRabiesItem(): CareTemplateItemInput {
  return {
    id: "rabies-core",
    category: "vaccine",
    title: "Rabies vaccination",
    note: DEFAULT_RABIES_NOTE,
    rrule: "RRULE:FREQ=YEARLY",
    anchor: "PET_AGE",
    startOffsetDays: 98,
  };
}

function speciesRabiesSchedule(rabiesItem: CareTemplateItemInput): Record<LifeStage, CareTemplateItemInput[]> {
  const boosterItem: CareTemplateItemInput = {
    ...rabiesItem,
    anchor: "PLAN_START",
    startOffsetDays: 0,
  };
  return {
    PUPPY_KITTEN: [rabiesItem],
    ADULT: [boosterItem],
    SENIOR: [boosterItem],
  };
}

function emptySpeciesSchedule(): Record<LifeStage, CareTemplateItemInput[]> {
  return { PUPPY_KITTEN: [], ADULT: [], SENIOR: [] };
}

function endemicRabiesSchedule(regionNote: string): Record<Species, Record<LifeStage, CareTemplateItemInput[]>> {
  const item: CareTemplateItemInput = {
    id: "rabies-core",
    category: "vaccine",
    title: "Rabies vaccination",
    note: regionNote,
    rrule: "RRULE:FREQ=YEARLY",
    anchor: "PET_AGE",
    startOffsetDays: 98,
    emphasis: true,
  };
  return {
    DOG: speciesRabiesSchedule(item),
    CAT: speciesRabiesSchedule(item),
  };
}

export const VACCINE_OVERLAYS: Partial<
  Record<ProtocolGroup, Record<Species, Record<LifeStage, CareTemplateItemInput[]>>>
> = {
  DEFAULT: {
    DOG: speciesRabiesSchedule(defaultRabiesItem()),
    CAT: speciesRabiesSchedule(defaultRabiesItem()),
  },
  // India: rabies is endemic across much of the country, so this overlay
  // strongly emphasizes it (Decision R8 — the one pinned per-region AC).
  IN: {
    DOG: speciesRabiesSchedule({
      id: "rabies-emphasis-in",
      category: "vaccine",
      title: "Rabies vaccination — strongly emphasized in India",
      note:
        "Rabies is endemic across much of India and rabies vaccination is strongly emphasized for dogs and cats here, and may be legally expected. " +
        VET_CONFIRM_SENTENCE,
      rrule: "RRULE:FREQ=YEARLY",
      anchor: "PET_AGE",
      startOffsetDays: 98,
      emphasis: true,
    }),
    CAT: speciesRabiesSchedule({
      id: "rabies-emphasis-in",
      category: "vaccine",
      title: "Rabies vaccination — strongly emphasized in India",
      note:
        "Rabies is endemic across much of India and rabies vaccination is strongly emphasized for dogs and cats here, and may be legally expected. " +
        VET_CONFIRM_SENTENCE,
      rrule: "RRULE:FREQ=YEARLY",
      anchor: "PET_AGE",
      startOffsetDays: 98,
      emphasis: true,
    }),
  },
  // Brazil: parts of the country have ongoing rabies risk in wildlife and
  // unvaccinated animal populations (WHO/TROCCAP regional guidance).
  BR: endemicRabiesSchedule(
    "Parts of Brazil have ongoing rabies risk in wildlife and unvaccinated animal populations, so rabies vaccination is strongly recommended for dogs and cats. " +
      VET_CONFIRM_SENTENCE,
  ),
  // Middle East / North Africa: several countries in this region have areas
  // of ongoing rabies risk (WHO regional guidance).
  MENA: endemicRabiesSchedule(
    "Several countries in this region have areas with ongoing rabies risk, so rabies vaccination is strongly recommended for dogs and cats. " +
      VET_CONFIRM_SENTENCE,
  ),
  // Southeast Asia: several countries in this region have areas of ongoing
  // rabies risk (WHO/TROCCAP regional guidance).
  SEA: endemicRabiesSchedule(
    "Several countries in this region have areas with ongoing rabies risk, so rabies vaccination is strongly recommended for dogs and cats. " +
      VET_CONFIRM_SENTENCE,
  ),
  // Australia: a rabies-free region, so the routine rabies item is omitted
  // here rather than carried over from `DEFAULT`; base-schedule items still
  // make the AU pack non-empty.
  AU: {
    DOG: emptySpeciesSchedule(),
    CAT: emptySpeciesSchedule(),
  },
};
