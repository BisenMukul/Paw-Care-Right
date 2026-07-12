import type { TriageResult } from "@pawcareright/types";

import { scanUnsafe } from "./detector";

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
});
