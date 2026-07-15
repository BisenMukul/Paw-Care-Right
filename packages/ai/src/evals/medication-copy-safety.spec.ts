import { MEDICATION_STATIC_COPY, type TriageResult } from "@pawcareright/types";

import { scanUnsafe } from "./detector";

/**
 * Detector-reuse lint test (T061 plan decision 7 / AC2 -- CLAUDE §7 rule 2,
 * the med tracker RECORDS, never suggests). Scans every user-facing
 * medication-tracker string, sourced from the `MEDICATION_STATIC_COPY` SSOT
 * in `@pawcareright/types` (the exact strings `apps/mobile/src/strings.ts`
 * renders -- no drift), through the REAL T038 `scanUnsafe` -- not a
 * re-implementation -- and asserts zero findings. A positive control (a
 * deliberately planted bad string) proves this spec is non-vacuous: if the
 * detector ever stopped flagging real bad input, this test would catch it.
 * If this spec ever fails on the SSOT copy, the fix is to the COPY, never to
 * weaken/skip this spec (plan Safety statement).
 */
function resultWith(overrides: Partial<TriageResult>): TriageResult {
  return {
    urgency: "VET_SOON",
    confidence: "medium",
    summary: "A sore leg should be checked by a vet.",
    possibleCauses: [],
    redFlagsToWatch: [],
    homeCare: [],
    doNot: [],
    vetQuestions: [],
    followUpHours: 24,
    ...overrides,
  };
}

describe("medication-copy-safety (T061 AC2)", () => {
  it("scanUnsafe(...) returns [] for every MEDICATION_STATIC_COPY string", () => {
    const findings = scanUnsafe(resultWith({ redFlagsToWatch: [...MEDICATION_STATIC_COPY] }));
    expect(findings).toEqual([]);
  });

  it("positive control: a planted dose suggestion IS flagged (proves this spec is non-vacuous)", () => {
    const findings = scanUnsafe(resultWith({ redFlagsToWatch: ["Give 5mg twice daily."] }));
    expect(findings.length).toBeGreaterThan(0);
  });
});
