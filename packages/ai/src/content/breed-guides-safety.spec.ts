import { allBreedGuides, type BreedGuide } from "@bombaypetcompany/data";

import { scanUnsafeText } from "../evals/detector";

/**
 * AC3 detector lint (T084 plan): the real `scanUnsafeText` over every
 * user-facing string of every guide in `allBreedGuides` — published **and**
 * drafts, since an unreviewed row is still committed text a future reviewer
 * could rubber-stamp. If a legitimate string trips this, the fix is always
 * the string (plan R5) — this spec never edits the detector.
 */

interface ScannedField {
  path: string;
  value: string;
}

function collectGuideFields(guide: BreedGuide): ScannedField[] {
  const prefix = `${guide.species}/${guide.slug}`;
  const fields: ScannedField[] = [
    { path: `${prefix}.temperament`, value: guide.temperament },
    { path: `${prefix}.exerciseNeeds.narrative`, value: guide.exerciseNeeds.narrative },
    { path: `${prefix}.groomingCadence.narrative`, value: guide.groomingCadence.narrative },
  ];

  guide.commonConditionAwareness.forEach((item, index) => {
    fields.push({ path: `${prefix}.commonConditionAwareness[${index}].topic`, value: item.topic });
    fields.push({ path: `${prefix}.commonConditionAwareness[${index}].prompt`, value: item.prompt });
  });

  return fields;
}

const allFields: ScannedField[] = allBreedGuides.flatMap(collectGuideFields);

describe("breed guide dataset — AC3 detector lint", () => {
  it("no guide string produces a detector finding", () => {
    const findings = allFields.flatMap((field) => scanUnsafeText(field.value, field.path));
    expect(findings).toEqual([]);
  });

  it("the lint actually scanned the shipped dataset (non-vacuity)", () => {
    expect(allBreedGuides.length).toBeGreaterThanOrEqual(50);

    // Derived independently of `collectGuideFields`: 3 fixed fields
    // (temperament, exerciseNeeds.narrative, groomingCadence.narrative) plus
    // 2 per commonConditionAwareness entry (topic + prompt). If the
    // collector ever silently drops a field, this exact-equality check
    // catches it — a `>=` floor would not (T084 F1 / P1 probe).
    const expectedFieldCount = allBreedGuides.reduce(
      (n, g) => n + 3 + 2 * g.commonConditionAwareness.length,
      0,
    );
    expect(allFields.length).toBe(expectedFieldCount);

    const draftGuideSlugs = new Set(
      allBreedGuides.filter((guide) => !guide.reviewed).map((guide) => `${guide.species}/${guide.slug}`),
    );
    const scannedADraftPath = allFields.some((field) =>
      Array.from(draftGuideSlugs).some((slugPrefix) => field.path.startsWith(`${slugPrefix}.`)),
    );
    expect(scannedADraftPath).toBe(true);
  });

  it("positive control: a planted dosage string IS flagged", () => {
    expect(scanUnsafeText("Give 5mg per kg twice daily.").length).toBeGreaterThanOrEqual(1);
  });

  it("positive control: a planted diagnosis string IS flagged", () => {
    expect(scanUnsafeText("This is a diagnosis of hip dysplasia.").length).toBeGreaterThanOrEqual(1);
  });
});
