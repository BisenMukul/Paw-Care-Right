import { SYMPTOM_CATEGORIES } from "@pawcareright/types";

import { getDescriptors, INTAKE_DESCRIPTORS } from "../src/checks/intake-descriptors";

// FOUNDER-UX-1 plan §7 audit surface: enum completeness + forbidden-language
// scan over every quick-pick descriptor string (mirrors the pattern in
// `packages/types/src/intake.spec.ts` "no intake copy contains diagnosis or
// dosing language").

describe("INTAKE_DESCRIPTORS enum completeness", () => {
  it.each(SYMPTOM_CATEGORIES)("category %s has at least one descriptor", (id) => {
    expect(INTAKE_DESCRIPTORS[id].length).toBeGreaterThan(0);
  });

  it("getDescriptors returns the list for every known category", () => {
    for (const id of SYMPTOM_CATEGORIES) {
      expect(getDescriptors(id)).toBe(INTAKE_DESCRIPTORS[id]);
    }
  });

  it('getDescriptors returns [] for an unknown category id', () => {
    expect(getDescriptors("nope")).toEqual([]);
  });
});

describe("no descriptor copy contains diagnosis or dosing language", () => {
  const DIAGNOSIS_WORD_PATTERN = /diagnos/i;
  const DOSING_PATTERN =
    /(\bmg\b|\bml\b|\bdose|dosage|milligram|per kg|administer|tablet|ibuprofen|paracetamol|acetaminophen|aspirin|benadryl|diphenhydramine|metacam|tramadol)/i;

  function allDescriptorStrings(): string[] {
    return SYMPTOM_CATEGORIES.flatMap((id) => [...INTAKE_DESCRIPTORS[id]]);
  }

  it("contains no diagnosis/diagnose language", () => {
    for (const value of allDescriptorStrings()) {
      expect(DIAGNOSIS_WORD_PATTERN.test(value)).toBe(false);
    }
  });

  it("contains no medication name/dosing/administration language", () => {
    for (const value of allDescriptorStrings()) {
      expect(DOSING_PATTERN.test(value)).toBe(false);
    }
  });
});
