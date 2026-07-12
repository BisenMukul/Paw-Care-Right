import { evaluateRedFlags } from "./engine";
import { RED_FLAG_RULES } from "./rules-table";
import type { RedFlagIntake } from "./types";

interface RuleCase {
  id: string;
  structuredIntake: RedFlagIntake;
  keywordIntake: RedFlagIntake;
  nearMissIntake: RedFlagIntake;
}

/**
 * One entry per rule id in `RED_FLAG_RULES` (declaration order). Each case
 * supplies a structured-sign positive, a free-text keyword positive, and an
 * honest near-miss negative (D2: near-misses contain no trigger phrase for
 * THIS rule, though other rules may still fire from the same input).
 */
const RULE_CASES: RuleCase[] = [
  {
    id: "toxin-ingestion",
    structuredIntake: { species: "DOG", signs: { toxin_ingestion: true } },
    keywordIntake: { species: "CAT", freeText: "ate poison" },
    nearMissIntake: { species: "DOG", freeText: "ate a treat and is playing normally" },
  },
  {
    id: "gdv-suspected",
    structuredIntake: {
      species: "DOG",
      signs: { retching_unproductive: true, distended_abdomen: true },
    },
    keywordIntake: { species: "DOG", freeText: "dry heaving, swollen abdomen" },
    nearMissIntake: {
      species: "CAT",
      signs: { retching_unproductive: true, distended_abdomen: true },
    },
  },
  {
    id: "urinary-blockage-cat",
    structuredIntake: { species: "CAT", sex: "MALE", signs: { straining_to_urinate: true } },
    keywordIntake: { species: "CAT", sex: "UNKNOWN", freeText: "straining to pee" },
    nearMissIntake: { species: "CAT", sex: "FEMALE", freeText: "straining to pee" },
  },
  {
    id: "seizure-prolonged-or-repeated",
    structuredIntake: { species: "DOG", signs: { seizure_prolonged_or_repeated: true } },
    keywordIntake: { species: "CAT", freeText: "seizing" },
    nearMissIntake: { species: "DOG", freeText: "shivering a little in the cold" },
  },
  {
    id: "collapse-unresponsive",
    structuredIntake: { species: "DOG", signs: { collapse_unresponsive: true } },
    keywordIntake: { species: "CAT", freeText: "collapsed" },
    nearMissIntake: { species: "DOG", freeText: "playing fetch happily" },
  },
  {
    id: "abnormal-gum-color",
    structuredIntake: { species: "DOG", signs: { abnormal_gum_color: true } },
    keywordIntake: { species: "CAT", freeText: "pale gums" },
    nearMissIntake: { species: "DOG", freeText: "gums look pink and healthy" },
  },
  {
    id: "breathing-difficulty",
    structuredIntake: { species: "DOG", signs: { breathing_difficulty: true } },
    keywordIntake: { species: "CAT", freeText: "trouble breathing" },
    nearMissIntake: { species: "DOG", freeText: "breathing normally and eating well" },
  },
  {
    id: "uncontrolled-bleeding",
    structuredIntake: { species: "DOG", signs: { uncontrolled_bleeding: true } },
    keywordIntake: { species: "CAT", freeText: "wont stop bleeding" },
    nearMissIntake: { species: "DOG", freeText: "small scratch, not bleeding" },
  },
  {
    id: "heatstroke",
    structuredIntake: { species: "DOG", signs: { heatstroke: true } },
    keywordIntake: { species: "CAT", freeText: "heatstroke" },
    nearMissIntake: { species: "DOG", freeText: "resting comfortably in the shade" },
  },
  {
    id: "envenomation",
    structuredIntake: { species: "DOG", signs: { envenomation: true } },
    keywordIntake: { species: "CAT", freeText: "snake bite" },
    nearMissIntake: { species: "DOG", freeText: "playing in the backyard, no bugs" },
  },
  {
    id: "major-trauma",
    structuredIntake: { species: "DOG", signs: { major_trauma: true } },
    keywordIntake: { species: "CAT", freeText: "hit by a car" },
    nearMissIntake: { species: "DOG", freeText: "jumped off the couch, walking fine" },
  },
  {
    id: "ocular-emergency",
    structuredIntake: { species: "DOG", signs: { ocular_emergency: true } },
    keywordIntake: { species: "CAT", freeText: "eye bulging" },
    nearMissIntake: { species: "DOG", freeText: "eyes bright and clear" },
  },
  {
    id: "sudden-inability-to-stand",
    structuredIntake: { species: "DOG", signs: { unable_to_stand: true } },
    keywordIntake: { species: "CAT", freeText: "cant stand" },
    nearMissIntake: { species: "DOG", freeText: "running around the yard" },
  },
  {
    id: "chocolate-ingestion-dog",
    structuredIntake: { species: "DOG", signs: { chocolate_ingestion: true } },
    keywordIntake: { species: "DOG", freeText: "ate chocolate" },
    nearMissIntake: { species: "DOG", freeText: "ate dog treats, seems fine" },
  },
  {
    id: "xylitol-ingestion-dog",
    structuredIntake: { species: "DOG", signs: { xylitol_ingestion: true } },
    keywordIntake: { species: "DOG", freeText: "sugar free gum" },
    nearMissIntake: { species: "DOG", freeText: "chewing on a toy" },
  },
  {
    id: "rodenticide-exposure",
    structuredIntake: { species: "DOG", signs: { rodenticide_exposure: true } },
    keywordIntake: { species: "CAT", freeText: "rat poison" },
    nearMissIntake: { species: "DOG", freeText: "playing with a toy mouse" },
  },
  {
    id: "linear-foreign-body-cat",
    structuredIntake: { species: "CAT", signs: { linear_foreign_body: true } },
    keywordIntake: { species: "CAT", freeText: "ate string" },
    nearMissIntake: { species: "CAT", freeText: "playing with a toy, no thread involved" },
  },
  {
    id: "distended-abdomen",
    structuredIntake: { species: "CAT", signs: { distended_abdomen: true } },
    keywordIntake: { species: "CAT", freeText: "bloated" },
    nearMissIntake: { species: "DOG", freeText: "eating normally, belly looks fine" },
  },
  {
    id: "urinary-obstruction-signs-cat",
    structuredIntake: {
      species: "CAT",
      sex: "FEMALE",
      signs: { straining_to_urinate: true, blood_in_urine: true },
    },
    keywordIntake: { species: "CAT", freeText: "straining to pee, blood in urine" },
    nearMissIntake: { species: "CAT", freeText: "straining to pee" },
  },
  {
    id: "open-fracture-or-deep-wound",
    structuredIntake: { species: "DOG", signs: { open_fracture_or_deep_wound: true } },
    keywordIntake: { species: "CAT", freeText: "open fracture" },
    nearMissIntake: { species: "DOG", freeText: "small scrape on the paw, looks fine" },
  },
  {
    id: "birthing-distress",
    structuredIntake: { species: "DOG", signs: { birthing_distress: true } },
    keywordIntake: { species: "CAT", freeText: "prolonged labor" },
    nearMissIntake: { species: "DOG", freeText: "just gave birth normally, puppies fine" },
  },
  {
    id: "neonatal-collapse",
    structuredIntake: { species: "DOG", signs: { neonatal_collapse: true } },
    keywordIntake: { species: "CAT", freeText: "fading puppy" },
    nearMissIntake: { species: "DOG", freeText: "puppy playing and nursing well" },
  },
];

describe("each rule: structured positive, keyword positive, near-miss negative", () => {
  it("RULE_CASES covers every rule id exactly once", () => {
    const tableIds = RED_FLAG_RULES.map((rule) => rule.id);
    const caseIds = RULE_CASES.map((ruleCase) => ruleCase.id);

    expect(caseIds.sort()).toEqual([...tableIds].sort());
  });

  it.each(RULE_CASES)("$id: structured positive fires as highest EMERGENCY_NOW", ({ id, structuredIntake }) => {
    const result = evaluateRedFlags(structuredIntake);

    expect(result.highest?.ruleId).toBe(id);
    expect(result.highest?.tierFloor).toBe("EMERGENCY_NOW");
  });

  it.each(RULE_CASES)("$id: keyword positive is present in matched", ({ id, keywordIntake }) => {
    const result = evaluateRedFlags(keywordIntake);

    expect(result.matched.some((match) => match.ruleId === id)).toBe(true);
  });

  it.each(RULE_CASES)("$id: honest near-miss does not fire this rule", ({ id, nearMissIntake }) => {
    const result = evaluateRedFlags(nearMissIntake);

    expect(result.matched.every((match) => match.ruleId !== id)).toBe(true);
  });
});

describe("male cat straining to urinate", () => {
  it("MALE cat + sign straining_to_urinate fires urinary-blockage-cat", () => {
    const result = evaluateRedFlags({ species: "CAT", sex: "MALE", signs: { straining_to_urinate: true } });

    expect(result.highest?.ruleId).toBe("urinary-blockage-cat");
    expect(result.highest?.tierFloor).toBe("EMERGENCY_NOW");
  });

  it("UNKNOWN-sex cat + freeText fires (fail-upward, R6)", () => {
    const result = evaluateRedFlags({ species: "CAT", sex: "UNKNOWN", freeText: "straining to pee" });

    expect(result.matched.some((match) => match.ruleId === "urinary-blockage-cat")).toBe(true);
  });

  it("MALE cat + freeText 'cant pee, in and out of litter box' fires", () => {
    const result = evaluateRedFlags({ species: "CAT", sex: "MALE", freeText: "cant pee, in and out of litter box" });

    expect(result.matched.some((match) => match.ruleId === "urinary-blockage-cat")).toBe(true);
  });

  it("FEMALE cat + freeText 'straining to pee' (no blood) does NOT fire; highest is null", () => {
    const result = evaluateRedFlags({ species: "CAT", sex: "FEMALE", freeText: "straining to pee" });

    expect(result.matched.some((match) => match.ruleId === "urinary-blockage-cat")).toBe(false);
    expect(result.matched.some((match) => match.ruleId === "urinary-obstruction-signs-cat")).toBe(false);
    expect(result.highest).toBeNull();
  });
});

describe("retching + distended abdomen dog (GDV)", () => {
  it("LARGE dog + both signs fires gdv-suspected", () => {
    const result = evaluateRedFlags({
      species: "DOG",
      sizeClass: "LARGE",
      signs: { retching_unproductive: true, distended_abdomen: true },
    });

    expect(result.matched.some((match) => match.ruleId === "gdv-suspected")).toBe(true);
  });

  it("dog + freeText 'dry heaving and his belly is swollen and hard' fires gdv-suspected", () => {
    const result = evaluateRedFlags({
      species: "DOG",
      freeText: "dry heaving and his belly is swollen and hard",
    });

    expect(result.matched.some((match) => match.ruleId === "gdv-suspected")).toBe(true);
  });

  it("SMALL dog + both signs still fires (size-agnostic)", () => {
    const result = evaluateRedFlags({
      species: "DOG",
      sizeClass: "SMALL",
      signs: { retching_unproductive: true, distended_abdomen: true },
    });

    expect(result.matched.some((match) => match.ruleId === "gdv-suspected")).toBe(true);
  });

  it("retching-only does NOT fire gdv-suspected or distended-abdomen; highest is null", () => {
    const result = evaluateRedFlags({ species: "DOG", freeText: "dry heaving" });

    expect(result.matched.some((match) => match.ruleId === "gdv-suspected")).toBe(false);
    expect(result.matched.some((match) => match.ruleId === "distended-abdomen")).toBe(false);
    expect(result.highest).toBeNull();
  });

  it("bloat-only does NOT fire gdv-suspected BUT DOES fire distended-abdomen (rule-18 split, R8)", () => {
    const result = evaluateRedFlags({ species: "DOG", freeText: "his belly is swollen" });

    expect(result.matched.some((match) => match.ruleId === "gdv-suspected")).toBe(false);
    expect(result.matched.some((match) => match.ruleId === "distended-abdomen")).toBe(true);
  });
});

describe("species gating", () => {
  it("a DOG-only rule (gdv-suspected) never fires for a CAT with the same signs", () => {
    const result = evaluateRedFlags({
      species: "CAT",
      signs: { retching_unproductive: true, distended_abdomen: true },
    });

    expect(result.matched.some((match) => match.ruleId === "gdv-suspected")).toBe(false);
  });

  it("a CAT-only rule (urinary-blockage-cat) never fires for a DOG", () => {
    const result = evaluateRedFlags({ species: "DOG", sex: "MALE", signs: { straining_to_urinate: true } });

    expect(result.matched.some((match) => match.ruleId === "urinary-blockage-cat")).toBe(false);
  });

  it("an ANY rule fires for both species", () => {
    const dogResult = evaluateRedFlags({ species: "DOG", signs: { collapse_unresponsive: true } });
    const catResult = evaluateRedFlags({ species: "CAT", signs: { collapse_unresponsive: true } });

    expect(dogResult.matched.some((match) => match.ruleId === "collapse-unresponsive")).toBe(true);
    expect(catResult.matched.some((match) => match.ruleId === "collapse-unresponsive")).toBe(true);
  });
});

describe("multiple matches, highest floor + all collected", () => {
  const multiMatchIntake: RedFlagIntake = {
    species: "DOG",
    signs: { retching_unproductive: true, distended_abdomen: true },
  };

  it("collects every matching rule (gdv-suspected and distended-abdomen both fire)", () => {
    const result = evaluateRedFlags(multiMatchIntake);

    expect(result.matched.length).toBeGreaterThanOrEqual(2);
    expect(result.highest).not.toBeNull();
    expect(result.matched).toContainEqual(expect.objectContaining({ ruleId: "gdv-suspected" }));
    expect(result.matched).toContainEqual(expect.objectContaining({ ruleId: "distended-abdomen" }));
  });

  it("stable table-order tie-break is deterministic across repeated calls", () => {
    const first = evaluateRedFlags(multiMatchIntake);
    const second = evaluateRedFlags(multiMatchIntake);

    expect(second.matched.map((match) => match.ruleId)).toEqual(first.matched.map((match) => match.ruleId));
  });
});

describe("engine applies NO global cat bias", () => {
  it("a CAT and a DOG hitting the same ANY rule get the same tierFloor", () => {
    const catResult = evaluateRedFlags({ species: "CAT", signs: { collapse_unresponsive: true } });
    const dogResult = evaluateRedFlags({ species: "DOG", signs: { collapse_unresponsive: true } });

    expect(catResult.highest?.tierFloor).toBe(dogResult.highest?.tierFloor);
  });
});

describe("purity / determinism", () => {
  it("evaluateRedFlags is a pure function: same input yields deep-equal output", () => {
    const intake: RedFlagIntake = { species: "DOG", freeText: "dry heaving, swollen abdomen" };

    const a = evaluateRedFlags(intake);
    const b = evaluateRedFlags(intake);

    expect(a).toEqual(b);
  });

  it("does not mutate the input intake object", () => {
    const intake: RedFlagIntake = { species: "DOG", freeText: "dry heaving" };
    const snapshot = JSON.parse(JSON.stringify(intake)) as unknown;

    evaluateRedFlags(intake);

    expect(intake).toEqual(snapshot);
  });
});

describe("<5ms per evaluation", () => {
  it("averages under 5ms per evaluateRedFlags call over N=1000 (steady-state, worst-case input)", () => {
    const worstCaseFreeText = "the pet seems a bit off today but is eating, drinking, and playing normally. ".repeat(7);
    const worstCaseIntake: RedFlagIntake = {
      species: "DOG",
      sex: "UNKNOWN",
      ageMonths: 36,
      weightKg: 25,
      sizeClass: "LARGE",
      signs: Object.fromEntries(
        [
          "toxin_ingestion",
          "chocolate_ingestion",
          "xylitol_ingestion",
          "rodenticide_exposure",
          "retching_unproductive",
          "distended_abdomen",
          "straining_to_urinate",
          "blood_in_urine",
          "seizure_prolonged_or_repeated",
          "collapse_unresponsive",
          "abnormal_gum_color",
          "breathing_difficulty",
          "uncontrolled_bleeding",
          "heatstroke",
          "envenomation",
          "major_trauma",
          "ocular_emergency",
          "unable_to_stand",
          "linear_foreign_body",
          "open_fracture_or_deep_wound",
          "birthing_distress",
          "neonatal_collapse",
        ].map((sign) => [sign, false]),
      ),
      freeText: worstCaseFreeText,
    };

    // Warm up (JIT), discard results.
    for (let i = 0; i < 50; i += 1) {
      evaluateRedFlags(worstCaseIntake);
    }

    const iterations = 1000;
    const start = performance.now();
    for (let i = 0; i < iterations; i += 1) {
      evaluateRedFlags(worstCaseIntake);
    }
    const totalMs = performance.now() - start;
    const averageMs = totalMs / iterations;

    expect(averageMs).toBeLessThan(5);
  });
});

describe("T031 checker probe gaps (review A1): colloquial phrasings fire via keyword channel", () => {
  it("MALE cat + freeText \"hasn't peed since yesterday\" fires urinary-blockage-cat", () => {
    const result = evaluateRedFlags({ species: "CAT", sex: "MALE", freeText: "hasn't peed since yesterday" });

    expect(result.matched.some((match) => match.ruleId === "urinary-blockage-cat")).toBe(true);
  });

  it("dog + freeText \"gums look white-ish\" fires abnormal-gum-color", () => {
    const result = evaluateRedFlags({ species: "DOG", freeText: "gums look white-ish" });

    expect(result.matched.some((match) => match.ruleId === "abnormal-gum-color")).toBe(true);
  });

  it("cat + freeText \"fell from the balcony\" fires major-trauma", () => {
    const result = evaluateRedFlags({ species: "CAT", freeText: "fell from the balcony" });

    expect(result.matched.some((match) => match.ruleId === "major-trauma")).toBe(true);
  });

  it("dog + freeText \"ate a brownie\" fires chocolate-ingestion-dog", () => {
    const result = evaluateRedFlags({ species: "DOG", freeText: "ate a brownie" });

    expect(result.matched.some((match) => match.ruleId === "chocolate-ingestion-dog")).toBe(true);
  });
});
