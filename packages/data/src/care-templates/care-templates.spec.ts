import { parseRRule, SPECIES, type ReminderType, type Species } from "@pawcareright/types";

import { BASE_SCHEDULES } from "./data/base";
import { VACCINE_OVERLAYS } from "./data/vaccine-overlays";
import {
  CATEGORY_TO_REMINDER_TYPE,
  LIFE_STAGES,
  PROTOCOL_GROUPS,
  TEMPLATE_ANCHORS,
  TEMPLATE_CATEGORIES,
  VET_CONFIRM_SENTENCE,
  careTemplateItemSchema,
  type CareTemplateItemInput,
  type LifeStage,
  type ProtocolGroup,
} from "./schema";
import { lifeStageForAgeMonths, resolveLifeStage } from "./life-stages";
import { protocolGroupForCountry } from "./protocol-groups";
import { resolveCareTemplate, resolveCareTemplateForPet } from "./index";

/** Flattens every authored item (base + every overlay group) for dataset-wide scans. */
function allAuthoredItems(): CareTemplateItemInput[] {
  const items: CareTemplateItemInput[] = [];
  for (const species of SPECIES) {
    for (const stage of LIFE_STAGES) {
      items.push(...BASE_SCHEDULES[species][stage]);
    }
  }
  for (const schedule of Object.values(VACCINE_OVERLAYS)) {
    for (const species of SPECIES) {
      for (const stage of LIFE_STAGES) {
        items.push(...schedule[species][stage]);
      }
    }
  }
  return items;
}

describe("care template schema — AC1 zod validation", () => {
  it("every base + overlay item parses under careTemplateItemSchema", () => {
    for (const item of allAuthoredItems()) {
      expect(() => careTemplateItemSchema.parse(item)).not.toThrow();
    }
  });

  it("confirm-with-vet refine rejects a note missing VET_CONFIRM_SENTENCE", () => {
    const badItem: CareTemplateItemInput = {
      id: "bad-item",
      category: "grooming",
      title: "Bad item",
      note: "This note forgets the pinned sentence entirely.",
      rrule: "RRULE:FREQ=MONTHLY",
      anchor: "PLAN_START",
      startOffsetDays: 0,
    };
    const result = careTemplateItemSchema.safeParse(badItem);
    expect(result.success).toBe(false);
  });

  it("confirm-with-vet refine accepts a note that includes VET_CONFIRM_SENTENCE", () => {
    const goodItem: CareTemplateItemInput = {
      id: "good-item",
      category: "grooming",
      title: "Good item",
      note: `This note includes the pinned sentence. ${VET_CONFIRM_SENTENCE}`,
      rrule: "RRULE:FREQ=MONTHLY",
      anchor: "PLAN_START",
      startOffsetDays: 0,
    };
    const result = careTemplateItemSchema.safeParse(goodItem);
    expect(result.success).toBe(true);
  });

  it("every item note includes VET_CONFIRM_SENTENCE", () => {
    for (const item of allAuthoredItems()) {
      expect(item.note).toContain(VET_CONFIRM_SENTENCE);
    }
  });

  it("CATEGORY_TO_REMINDER_TYPE maps every category to a valid ReminderType", () => {
    const VALID_REMINDER_TYPES: ReminderType[] = ["VACCINE", "PARASITE", "MEDICATION", "GROOMING", "DENTAL", "VET_VISIT", "CUSTOM"];
    for (const category of TEMPLATE_CATEGORIES) {
      expect(VALID_REMINDER_TYPES).toContain(CATEGORY_TO_REMINDER_TYPE[category]);
    }
  });
});

describe("care template resolver — AC2 full 54-cell matrix meta-test", () => {
  const cells: Array<[Species, LifeStage, ProtocolGroup]> = [];
  for (const species of SPECIES) {
    for (const stage of LIFE_STAGES) {
      for (const group of PROTOCOL_GROUPS) {
        cells.push([species, stage, group]);
      }
    }
  }

  it("materializes exactly 54 cells", () => {
    expect(cells.length).toBe(54);
  });

  it.each(cells)("resolves a valid, non-empty pack for %s / %s / %s", (species, stage, group) => {
    const resolved = resolveCareTemplate(species, stage, group);
    expect(resolved.items.length).toBeGreaterThan(0);

    const ids = resolved.items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const item of resolved.items) {
      expect(TEMPLATE_CATEGORIES as readonly string[]).toContain(item.category);
      expect(TEMPLATE_ANCHORS as readonly string[]).toContain(item.anchor);
      expect(item.note).toContain(VET_CONFIRM_SENTENCE);

      const parsed = parseRRule(item.rrule);
      expect(parsed.ok).toBe(true);
    }
  });
});

describe("care template resolver — AC3 IN rabies emphasis + DEFAULT contrast", () => {
  it.each(["DOG", "CAT"] as const)("IN resolves a rabies vaccine item with emphasis=true for %s (PUPPY_KITTEN)", (species) => {
    const resolved = resolveCareTemplate(species, "PUPPY_KITTEN", "IN");
    const rabiesItem = resolved.items.find((item) => item.category === "vaccine" && item.id.includes("rabies"));
    expect(rabiesItem).toBeDefined();
    expect(rabiesItem?.title.toLowerCase()).toContain("rabies");
    expect(rabiesItem?.emphasis).toBe(true);
  });

  it.each(["DOG", "CAT"] as const)("IN resolves a rabies vaccine item with emphasis=true for %s (ADULT)", (species) => {
    const resolved = resolveCareTemplate(species, "ADULT", "IN");
    const rabiesItem = resolved.items.find((item) => item.category === "vaccine" && item.id.includes("rabies"));
    expect(rabiesItem).toBeDefined();
    expect(rabiesItem?.title.toLowerCase()).toContain("rabies");
    expect(rabiesItem?.emphasis).toBe(true);
  });

  it("DEFAULT group rabies emphasis is false", () => {
    const resolved = resolveCareTemplate("DOG", "ADULT", "DEFAULT");
    const rabiesItem = resolved.items.find((item) => item.category === "vaccine" && item.id.includes("rabies"));
    expect(rabiesItem).toBeDefined();
    expect(rabiesItem?.emphasis).toBe(false);
  });
});

describe("care template dataset — §7 safety scan (dosing/diagnosis/brand language)", () => {
  const DIAGNOSIS_WORD_PATTERN = /diagnos/i;
  const NUMERIC_UNIT_DOSING_PATTERN = /\b\d+(\.\d+)?\s*(mg|ml|mcg|g|kg|iu)\b/i;
  const MG_PER_KG_PATTERN = /mg\s*\/\s*kg/i;
  const BRAND_DENYLIST = [
    "frontline",
    "bravecto",
    "nexgard",
    "simparica",
    "seresto",
    "advantage",
    "advantix",
    "revolution",
    "heartgard",
    "milbemax",
    "drontal",
    "panacur",
    "apoquel",
    "comfortis",
    "credelio",
  ];
  const BRAND_PATTERN = new RegExp(`\\b(${BRAND_DENYLIST.join("|")})\\b`, "i");

  function allResolvedItems() {
    const items: Array<{ id: string; title: string; note: string }> = [];
    for (const species of SPECIES) {
      for (const stage of LIFE_STAGES) {
        for (const group of PROTOCOL_GROUPS) {
          items.push(...resolveCareTemplate(species, stage, group).items);
        }
      }
    }
    return items;
  }

  it("no title/note contains diagnosis language", () => {
    const offenders: string[] = [];
    for (const item of allResolvedItems()) {
      if (DIAGNOSIS_WORD_PATTERN.test(item.title)) offenders.push(`${item.id}.title`);
      if (DIAGNOSIS_WORD_PATTERN.test(item.note)) offenders.push(`${item.id}.note`);
    }
    expect(offenders).toEqual([]);
  });

  it("no title/note contains a dosing numeric-unit amount or mg/kg", () => {
    const offenders: string[] = [];
    for (const item of allResolvedItems()) {
      for (const [field, value] of [["title", item.title], ["note", item.note]] as const) {
        if (NUMERIC_UNIT_DOSING_PATTERN.test(value) || MG_PER_KG_PATTERN.test(value)) {
          offenders.push(`${item.id}.${field}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no title/note contains a brand/product name", () => {
    const offenders: string[] = [];
    for (const item of allResolvedItems()) {
      if (BRAND_PATTERN.test(item.title)) offenders.push(`${item.id}.title`);
      if (BRAND_PATTERN.test(item.note)) offenders.push(`${item.id}.note`);
    }
    expect(offenders).toEqual([]);
  });
});

describe("care template resolver — fallback/mapping", () => {
  it("unknown group string resolves to DEFAULT", () => {
    const resolved = resolveCareTemplate("DOG", "ADULT", "ZZ" as ProtocolGroup);
    expect(resolved.group).toBe("DEFAULT");
    expect(resolved.items.length).toBeGreaterThan(0);
  });

  it("resolveCareTemplateForPet with ageMonths null resolves the ADULT pack", () => {
    const resolved = resolveCareTemplateForPet({ species: "DOG", ageMonths: null, countryCode: "US" });
    expect(resolved.lifeStage).toBe("ADULT");
  });

  it("resolveCareTemplateForPet with ageMonths undefined resolves the ADULT pack", () => {
    const resolved = resolveCareTemplateForPet({ species: "CAT" });
    expect(resolved.lifeStage).toBe("ADULT");
  });

  it("resolveCareTemplateForPet with unknown countryCode resolves the DEFAULT group", () => {
    const resolved = resolveCareTemplateForPet({ species: "DOG", countryCode: "ZZ" });
    expect(resolved.group).toBe("DEFAULT");
  });

  it("resolveCareTemplateForPet with omitted countryCode resolves the DEFAULT group", () => {
    const resolved = resolveCareTemplateForPet({ species: "CAT" });
    expect(resolved.group).toBe("DEFAULT");
  });
});

describe("life-stage boundaries", () => {
  it.each([
    ["DOG", 11, "PUPPY_KITTEN"],
    ["DOG", 12, "ADULT"],
    ["DOG", 83, "ADULT"],
    ["DOG", 84, "SENIOR"],
    ["CAT", 11, "PUPPY_KITTEN"],
    ["CAT", 12, "ADULT"],
    ["CAT", 119, "ADULT"],
    ["CAT", 120, "SENIOR"],
  ] as const)("%s at %i months -> %s", (species, ageMonths, expected) => {
    expect(lifeStageForAgeMonths(species, ageMonths)).toBe(expected);
  });

  it("resolveLifeStage with undefined age -> ADULT", () => {
    expect(resolveLifeStage("DOG")).toBe("ADULT");
  });

  it("resolveLifeStage with null age -> ADULT", () => {
    expect(resolveLifeStage("CAT", null)).toBe("ADULT");
  });
});

describe("protocolGroupForCountry", () => {
  it.each([
    ["US", "NA"],
    ["GB", "UK"],
    ["IN", "IN"],
    ["in", "IN"],
    ["ZZ", "DEFAULT"],
  ] as const)("%s -> %s", (input, expected) => {
    expect(protocolGroupForCountry(input)).toBe(expected);
  });

  it("undefined -> DEFAULT", () => {
    expect(protocolGroupForCountry(undefined)).toBe("DEFAULT");
  });
});
