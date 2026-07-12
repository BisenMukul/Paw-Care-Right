import { parseTriage, URGENCY_SEVERITY, URGENCY_TIERS, VET_SOON_FLOOR_SEVERITY } from "@pawcareright/types";

import { TRIAGE_EXEMPLARS } from "./exemplars";

const DIAGNOSIS_PATTERN = /diagnos/i;
const DOSING_PATTERN =
  /(\bmg\b|\bml\b|\bdose|dosage|milligram|per kg|administer|tablet|ibuprofen|paracetamol|acetaminophen|aspirin|benadryl|diphenhydramine|metacam|tramadol)/i;

describe("TRIAGE_EXEMPLARS integrity", () => {
  it("has between 6 and 8 exemplars with unique ids", () => {
    expect(TRIAGE_EXEMPLARS.length).toBeGreaterThanOrEqual(6);
    expect(TRIAGE_EXEMPLARS.length).toBeLessThanOrEqual(8);

    const ids = TRIAGE_EXEMPLARS.map((exemplar) => exemplar.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every exemplar output passes parseTriage", () => {
    TRIAGE_EXEMPLARS.forEach((exemplar) => {
      expect(parseTriage(exemplar.output).ok).toBe(true);
    });
  });

  it("exemplars span all tiers and both species", () => {
    const tiers = new Set(TRIAGE_EXEMPLARS.map((exemplar) => exemplar.tier));
    expect(tiers).toEqual(new Set(URGENCY_TIERS));

    const species = new Set(TRIAGE_EXEMPLARS.map((exemplar) => exemplar.species));
    expect(species.has("DOG")).toBe(true);
    expect(species.has("CAT")).toBe(true);
  });

  it("has at least one low-confidence floor exemplar", () => {
    const hasFloorExemplar = TRIAGE_EXEMPLARS.some(
      (exemplar) =>
        exemplar.output.confidence === "low" && URGENCY_SEVERITY[exemplar.output.urgency] <= VET_SOON_FLOOR_SEVERITY,
    );
    expect(hasFloorExemplar).toBe(true);
  });

  it("every emergency/VET_24H exemplar has empty homeCare", () => {
    TRIAGE_EXEMPLARS.filter((exemplar) => exemplar.tier === "EMERGENCY_NOW" || exemplar.tier === "VET_24H").forEach(
      (exemplar) => {
        expect(exemplar.output.homeCare).toEqual([]);
      },
    );
  });

  it("exemplar outputs and user turns contain no diagnosis or dosing language (AC4)", () => {
    TRIAGE_EXEMPLARS.forEach((exemplar) => {
      const strings: string[] = [
        exemplar.userText,
        exemplar.output.summary,
        ...exemplar.output.possibleCauses.flatMap((cause) => [cause.name, cause.whyItFits]),
        ...exemplar.output.redFlagsToWatch,
        ...exemplar.output.homeCare,
        ...exemplar.output.doNot,
        ...exemplar.output.vetQuestions,
      ];

      strings.forEach((text) => {
        expect(text).not.toMatch(DIAGNOSIS_PATTERN);
        expect(text).not.toMatch(DOSING_PATTERN);
      });
    });
  });
});
