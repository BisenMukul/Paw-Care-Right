import type { TriageResult } from "@bombaypetcompany/types";

import { findingCodes, scanUnsafe, scanUnsafeText } from "./detector";

function resultWith(overrides: Partial<TriageResult>): TriageResult {
  return {
    urgency: "VET_SOON",
    confidence: "medium",
    summary: "A sore leg should be checked by a vet.",
    possibleCauses: [],
    redFlagsToWatch: [],
    homeCare: [],
    doNot: ["Do not give human medications to your pet."],
    vetQuestions: [],
    followUpHours: 24,
    ...overrides,
  };
}

describe("scanUnsafe", () => {
  it("returns [] for a clean result", () => {
    expect(scanUnsafe(resultWith({}))).toEqual([]);
  });

  it("flags a dosing number with a unit (e.g. '5 mg')", () => {
    const findings = scanUnsafe(resultWith({ doNot: ["Give 5 mg twice daily."] }));
    expect(findings.length).toBeGreaterThan(0);
  });

  it("flags an mg/kg ratio", () => {
    const findings = scanUnsafe(resultWith({ doNot: ["A dose of 2 mg/kg is common in humans."] }));
    expect(findings.length).toBeGreaterThan(0);
  });

  it("flags 'per kg' dosing phrasing", () => {
    const findings = scanUnsafe(resultWith({ doNot: ["Never give 1 tablet per kg of body weight."] }));
    expect(findings.length).toBeGreaterThan(0);
  });

  it("flags diagnosis language", () => {
    const findings = scanUnsafe(resultWith({ summary: "This is a firm diagnosis of gastritis." }));
    expect(findings.length).toBeGreaterThan(0);
  });

  it("does not flag a drug NAME alone (no number/unit) - refusal-style copy stays clean", () => {
    const findings = scanUnsafe(
      resultWith({
        summary: "I can't help with giving human medicine to a pet. Please have a vet check his leg.",
        doNot: ["Do not give ibuprofen or other human painkillers to your pet."],
      }),
    );
    expect(findings).toEqual([]);
  });

  it("asserts the structured '<CODE>: <path>: <excerpt>' finding prefix", () => {
    const findings = scanUnsafe(resultWith({ doNot: ["give 5 mg"] }));
    expect(findings[0]).toMatch(/^DOSING: doNot\[0\]:/);
  });

  describe("DOSING — digit-less/frequency phrasing", () => {
    it("flags a spelled-out pill count ('one pill')", () => {
      const findings = scanUnsafe(resultWith({ homeCare: ["Give him one pill twice a day"] }));
      expect(findings.length).toBeGreaterThan(0);
    });

    it("flags a fractional tablet phrase ('half a tablet')", () => {
      const findings = scanUnsafe(resultWith({ doNot: ["half a tablet is enough"] }));
      expect(findings.length).toBeGreaterThan(0);
    });

    it("flags an administration verb near 'every N hours'", () => {
      const findings = scanUnsafe(resultWith({ homeCare: ["give one every 8 hours"] }));
      expect(findings.length).toBeGreaterThan(0);
    });

    it("does NOT flag legitimate monitoring cadence ('every few hours')", () => {
      const findings = scanUnsafe(resultWith({ redFlagsToWatch: ["Check on him every few hours"] }));
      expect(findings).toEqual([]);
    });

    it("does NOT flag legitimate monitoring cadence ('every couple of hours', no admin verb + no digit)", () => {
      const findings = scanUnsafe(resultWith({ homeCare: ["Monitor every couple of hours"] }));
      expect(findings).toEqual([]);
    });
  });

  describe("DRUG_RECOMMENDATION — warning-context exemption", () => {
    it("flags a bare drug suggestion ('you could try ibuprofen')", () => {
      const findings = scanUnsafe(resultWith({ homeCare: ["You could try ibuprofen for the pain"] }));
      expect(findings.length).toBeGreaterThan(0);
    });

    it("flags a bare drug suggestion ('give him benadryl to calm down' — no warning cue)", () => {
      const findings = scanUnsafe(resultWith({ doNot: ["give him benadryl to calm down"] }));
      expect(findings.length).toBeGreaterThan(0);
    });

    it("does NOT flag a negated drug warning ('Never give aspirin to a cat')", () => {
      const findings = scanUnsafe(resultWith({ doNot: ["Never give aspirin to a cat"] }));
      expect(findings).toEqual([]);
    });

    it("does NOT flag a danger warning ('Acetaminophen can be dangerous to cats.')", () => {
      const findings = scanUnsafe(resultWith({ summary: "Acetaminophen can be dangerous to cats." }));
      expect(findings).toEqual([]);
    });

    it("does NOT flag an avoidance warning in homeCare ('Avoid ibuprofen entirely')", () => {
      const findings = scanUnsafe(resultWith({ homeCare: ["Avoid ibuprofen entirely"] }));
      expect(findings).toEqual([]);
    });
  });

  describe("HARM_ENABLING — DIY/procedure adjacency", () => {
    it("flags DIY-then-procedure ('To sedate your dog at home, use...')", () => {
      const findings = scanUnsafe(resultWith({ summary: "To sedate your dog at home, use a spoon of..." }));
      expect(findings.length).toBeGreaterThan(0);
    });

    it("flags procedure-then-DIY ('You can perform the stitches yourself')", () => {
      const findings = scanUnsafe(resultWith({ homeCare: ["You can perform the stitches yourself"] }));
      expect(findings.length).toBeGreaterThan(0);
    });

    it("flags at-home euthanasia phrasing", () => {
      const findings = scanUnsafe(resultWith({ doNot: ["at-home euthanasia is fine"] }));
      expect(findings.length).toBeGreaterThan(0);
    });

    it("flags dog-fighting conditioning phrasing", () => {
      const findings = scanUnsafe(resultWith({ summary: "Condition your dog for fighting by..." }));
      expect(findings.length).toBeGreaterThan(0);
    });

    it("does NOT flag a generic refusal ('I can't help with this; please see a licensed veterinarian.')", () => {
      const findings = scanUnsafe(
        resultWith({ summary: "I can't help with this; please see a licensed veterinarian." }),
      );
      expect(findings).toEqual([]);
    });

    it("does NOT flag a procedure term with no DIY adjacency ('Declawing should be discussed with your vet.')", () => {
      const findings = scanUnsafe(resultWith({ summary: "Declawing should be discussed with your vet." }));
      expect(findings).toEqual([]);
    });
  });
});

describe("scanUnsafeText (T081 — free-text seam over the same pattern set)", () => {
  it("flags a DOSING finding on free text ('give 5 mg/kg')", () => {
    const findings = scanUnsafeText("You could give 5 mg/kg twice a day.");
    expect(findings.some((f) => f.startsWith("DOSING:"))).toBe(true);
  });

  it("flags a DRUG_RECOMMENDATION finding on free text ('give him ibuprofen')", () => {
    const findings = scanUnsafeText("Just give him ibuprofen for the pain.");
    expect(findings.some((f) => f.startsWith("DRUG_RECOMMENDATION:"))).toBe(true);
  });

  it("flags a HARM_ENABLING finding on free text ('how to sedate your dog at home')", () => {
    const findings = scanUnsafeText("Here is how to sedate your dog at home safely.");
    expect(findings.some((f) => f.startsWith("HARM_ENABLING:"))).toBe(true);
  });

  it("flags a DIAGNOSIS_LANGUAGE finding on free text ('the diagnosis is')", () => {
    const findings = scanUnsafeText("The diagnosis is gastritis.");
    expect(findings.some((f) => f.startsWith("DIAGNOSIS_LANGUAGE:"))).toBe(true);
  });

  it("returns [] for clean chat prose", () => {
    expect(scanUnsafeText("It sounds like he's a bit off his food today; keep an eye on him.")).toEqual([]);
  });

  it("returns [] for the default path label and a custom path label", () => {
    expect(scanUnsafeText("clean text")).toEqual([]);
    expect(scanUnsafeText("clean text", "chunk")).toEqual([]);
  });

  it("uses the custom path in the finding prefix", () => {
    const findings = scanUnsafeText("give 5 mg", "chunk");
    expect(findings[0]).toMatch(/^DOSING: chunk:/);
  });
});

describe("findingCodes (T082 — code extraction only, no change to scanUnsafeText/scanUnsafe)", () => {
  it("extracts and sorts the CODE prefix of each finding", () => {
    expect(findingCodes(["HARM_ENABLING: text: x", "DOSING: text: y"])).toEqual(["DOSING", "HARM_ENABLING"]);
  });

  it("dedupes repeated codes", () => {
    expect(findingCodes(["DOSING: a: x", "DOSING: b: y"])).toEqual(["DOSING"]);
  });

  it("ignores any string without a known code prefix", () => {
    expect(findingCodes(["NOT_A_CODE: a: b", "DOSING: a: b"])).toEqual(["DOSING"]);
  });

  it("returns [] for an empty findings array", () => {
    expect(findingCodes([])).toEqual([]);
  });

  it("never throws on malformed strings (no colon, empty string)", () => {
    expect(() => findingCodes(["garbage", "", "DOSING"])).not.toThrow();
    expect(findingCodes(["garbage", "", "DOSING"])).toEqual([]);
  });

  it("matches the real output of scanUnsafeText end to end", () => {
    const findings = scanUnsafeText("Give 5 mg/kg of ibuprofen every 8 hours.");
    expect(findingCodes(findings)).toEqual(["DOSING", "DRUG_RECOMMENDATION"]);
  });
});
