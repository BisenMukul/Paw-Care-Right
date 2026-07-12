import { normalizeItem, singularize } from "./normalize";
import { toxinRowSchema, TOXIN_CATEGORIES, type ToxinCategory } from "./schema";
import { toxins } from "./index";

const CATEGORY_MINIMUMS: Record<ToxinCategory, number> = {
  "human-food": 85,
  plant: 50,
  "household-chemical": 22,
  "human-med": 22,
  "pest-bait": 12,
  other: 9,
};

describe("toxin dataset — counts", () => {
  it("has at least 220 items total", () => {
    expect(toxins.length).toBeGreaterThanOrEqual(220);
  });

  it.each(TOXIN_CATEGORIES)("category %s meets its minimum count", (category) => {
    const count = toxins.filter((t) => t.category === category).length;
    expect(count).toBeGreaterThanOrEqual(CATEGORY_MINIMUMS[category]);
  });
});

describe("toxin dataset — schema validity", () => {
  it("every row parses under toxinRowSchema", () => {
    expect(() => toxinRowSchema.array().parse(toxins)).not.toThrow();
  });

  it("every row's category is one of TOXIN_CATEGORIES", () => {
    for (const row of toxins) {
      expect(TOXIN_CATEGORIES as readonly string[]).toContain(row.category);
    }
  });
});

describe("toxin dataset — uniqueness", () => {
  it("ids are unique", () => {
    const ids = toxins.map((t) => t.id);
    expect(new Set(ids).size).toBe(toxins.length);
  });

  it("no normalized name/alias key maps to two different ids", () => {
    const keyToId = new Map<string, string>();
    const conflicts: string[] = [];

    for (const row of toxins) {
      const rawForms = [row.name, row.id.replace(/-/g, " "), ...row.aliases];
      for (const raw of rawForms) {
        const norm = normalizeItem(raw);
        if (norm.length === 0) {
          continue;
        }
        for (const key of new Set([norm, singularize(norm)])) {
          const existing = keyToId.get(key);
          if (existing && existing !== row.id) {
            conflicts.push(`"${key}" -> ${existing} and ${row.id}`);
          } else {
            keyToId.set(key, row.id);
          }
        }
      }
    }

    expect(conflicts).toEqual([]);
  });
});

describe("toxin dataset — pinned anchor verdicts (transcribed exactly from the plan)", () => {
  it("grapes: dog emergency, cat toxic", () => {
    const row = toxins.find((t) => t.id === "grapes");
    expect(row).toBeDefined();
    expect(row?.verdicts).toEqual({ dog: "emergency", cat: "toxic" });
    expect(row?.aliases).toEqual(expect.arrayContaining(["grape", "raisin", "raisins", "sultana", "currant"]));
  });

  it("xylitol: dog emergency, cat caution", () => {
    const row = toxins.find((t) => t.id === "xylitol");
    expect(row).toBeDefined();
    expect(row?.verdicts).toEqual({ dog: "emergency", cat: "caution" });
    expect(row?.aliases).toEqual(
      expect.arrayContaining(["birch sugar", "sugar free gum", "sugar-free gum", "sweetener"]),
    );
  });

  it("true-lilies: dog caution, cat emergency", () => {
    const row = toxins.find((t) => t.id === "true-lilies");
    expect(row).toBeDefined();
    expect(row?.verdicts).toEqual({ dog: "caution", cat: "emergency" });
    expect(row?.aliases).toEqual(
      expect.arrayContaining(["lily", "lilies", "easter lily", "tiger lily", "daylily", "stargazer", "lilium"]),
    );
  });

  it("onion: dog toxic, cat toxic", () => {
    const row = toxins.find((t) => t.id === "onion");
    expect(row).toBeDefined();
    expect(row?.verdicts).toEqual({ dog: "toxic", cat: "toxic" });
    expect(row?.aliases).toEqual(
      expect.arrayContaining([
        "onions",
        "garlic",
        "chives",
        "leek",
        "shallot",
        "allium",
        "onion powder",
        "garlic powder",
      ]),
    );
  });

  it("chocolate: dog toxic, cat toxic", () => {
    const row = toxins.find((t) => t.id === "chocolate");
    expect(row).toBeDefined();
    expect(row?.verdicts).toEqual({ dog: "toxic", cat: "toxic" });
    expect(row?.aliases).toEqual(
      expect.arrayContaining([
        "choco",
        "cocoa",
        "cacao",
        "dark chocolate",
        "milk chocolate",
        "baking chocolate",
        "chocolot",
        "chocalate",
      ]),
    );
  });
});

describe("toxin dataset — §7 safety scan (dosing/diagnosis language)", () => {
  const DIAGNOSIS_WORD_PATTERN = /diagnos/i;
  const NUMERIC_UNIT_DOSING_PATTERN = /\b\d+\s*(mg|ml|mcg|g|kg|iu)\b/i;
  const MG_PER_KG_PATTERN = /mg\s*\/\s*kg/i;
  const PER_BODYWEIGHT_PATTERN = /per\s+(kg|pound|lb)\b/i;

  it("no note/quantityNuance contains diagnosis language", () => {
    const offenders: string[] = [];
    for (const row of toxins) {
      if (DIAGNOSIS_WORD_PATTERN.test(row.note)) {
        offenders.push(`${row.id}.note`);
      }
      if (row.quantityNuance && DIAGNOSIS_WORD_PATTERN.test(row.quantityNuance)) {
        offenders.push(`${row.id}.quantityNuance`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no note/quantityNuance contains a dosing amount/unit", () => {
    const offenders: string[] = [];
    for (const row of toxins) {
      const fields: Array<[string, string | undefined]> = [
        ["note", row.note],
        ["quantityNuance", row.quantityNuance],
      ];
      for (const [field, value] of fields) {
        if (!value) {
          continue;
        }
        if (
          NUMERIC_UNIT_DOSING_PATTERN.test(value) ||
          MG_PER_KG_PATTERN.test(value) ||
          PER_BODYWEIGHT_PATTERN.test(value)
        ) {
          offenders.push(`${row.id}.${field}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
