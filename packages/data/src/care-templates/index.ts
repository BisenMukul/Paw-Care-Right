import { SPECIES, type ReminderType, type Species } from "@pawcareright/types";

import { BASE_SCHEDULES } from "./data/base";
import { VACCINE_OVERLAYS } from "./data/vaccine-overlays";
import { resolveLifeStage } from "./life-stages";
import { protocolGroupForCountry } from "./protocol-groups";
import {
  CATEGORY_TO_REMINDER_TYPE,
  LIFE_STAGES,
  PROTOCOL_GROUPS,
  careTemplateItemSchema,
  type CareTemplateItem,
  type CareTemplateItemInput,
  type LifeStage,
  type ProtocolGroup,
} from "./schema";

// Parsing at module load is the runtime validation layer; `care-templates.spec.ts`
// is the build/test-time layer that additionally asserts the full resolved
// matrix (mirrors packages/data/src/toxins/index.ts).
type SpeciesStageItems = Record<Species, Record<LifeStage, readonly CareTemplateItem[]>>;

function parseSpeciesStageItems(
  input: Record<Species, Record<LifeStage, CareTemplateItemInput[]>>,
): SpeciesStageItems {
  const result = {} as { [S in Species]: { [L in LifeStage]: readonly CareTemplateItem[] } };
  for (const species of SPECIES) {
    const perStage = {} as { [L in LifeStage]: readonly CareTemplateItem[] };
    for (const stage of LIFE_STAGES) {
      perStage[stage] = Object.freeze(input[species][stage].map((item) => careTemplateItemSchema.parse(item)));
    }
    result[species] = Object.freeze(perStage);
  }
  return Object.freeze(result);
}

const BASE: SpeciesStageItems = parseSpeciesStageItems(BASE_SCHEDULES);

const OVERLAYS: Partial<Record<ProtocolGroup, SpeciesStageItems>> = Object.freeze(
  Object.fromEntries(
    (Object.entries(VACCINE_OVERLAYS) as Array<[ProtocolGroup, Record<Species, Record<LifeStage, CareTemplateItemInput[]>>]>).map(
      ([group, schedule]) => [group, parseSpeciesStageItems(schedule)],
    ),
  ),
) as Partial<Record<ProtocolGroup, SpeciesStageItems>>;

/** Runtime-narrows an out-of-enum group string to `"DEFAULT"` (see plan resolver API). */
function normalizeGroup(group: ProtocolGroup): ProtocolGroup {
  return (PROTOCOL_GROUPS as readonly string[]).includes(group) ? group : "DEFAULT";
}

export interface ResolvedCareTemplateItem extends CareTemplateItem {
  reminderType: ReminderType;
}

export interface ResolvedCareTemplate {
  species: Species;
  lifeStage: LifeStage;
  /** The group actually applied — the requested group if valid, `"DEFAULT"` only when the requested group is not in `PROTOCOL_GROUPS`. */
  group: ProtocolGroup;
  items: ResolvedCareTemplateItem[];
}

/**
 * Resolver API for T055 (instantiate) / T057 (collapse) / T059 (wizard).
 * NEVER throws for a valid `Species`/`LifeStage`. Base items (group-
 * independent) are always included; the vaccine overlay for `group` is
 * merged in, falling back to `VACCINE_OVERLAYS.DEFAULT` when `group` has no
 * explicit overlay entry (Decision R1).
 */
export function resolveCareTemplate(species: Species, lifeStage: LifeStage, group: ProtocolGroup): ResolvedCareTemplate {
  const resolvedGroup = normalizeGroup(group);
  const overlaySchedule = OVERLAYS[resolvedGroup] ?? OVERLAYS.DEFAULT;
  const baseItems = BASE[species][lifeStage];
  const overlayItems = overlaySchedule ? overlaySchedule[species][lifeStage] : [];

  const items: ResolvedCareTemplateItem[] = [...baseItems, ...overlayItems].map((item) => ({
    ...item,
    reminderType: CATEGORY_TO_REMINDER_TYPE[item.category],
  }));

  return { species, lifeStage, group: resolvedGroup, items };
}

/**
 * The single honest entry point T059 calls: `lifeStage` via
 * `resolveLifeStage` (absent age -> `ADULT`, Decision R6) and `group` via
 * `protocolGroupForCountry` (unknown country -> `DEFAULT`).
 */
export function resolveCareTemplateForPet(input: {
  species: Species;
  ageMonths?: number | null;
  countryCode?: string | null;
}): ResolvedCareTemplate {
  const lifeStage = resolveLifeStage(input.species, input.ageMonths);
  const group = protocolGroupForCountry(input.countryCode);
  return resolveCareTemplate(input.species, lifeStage, group);
}

export {
  CATEGORY_TO_REMINDER_TYPE,
  LIFE_STAGES,
  PROTOCOL_GROUPS,
  TEMPLATE_ANCHORS,
  TEMPLATE_CATEGORIES,
  VET_CONFIRM_SENTENCE,
} from "./schema";
export type { CareTemplateItem, CareTemplateItemInput, LifeStage, ProtocolGroup, TemplateAnchor, TemplateCategory } from "./schema";
export { lifeStageForAgeMonths, resolveLifeStage } from "./life-stages";
export { protocolGroupForCountry } from "./protocol-groups";
