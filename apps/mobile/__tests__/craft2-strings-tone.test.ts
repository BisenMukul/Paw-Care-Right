import { strings } from "../src/strings";

/**
 * CRAFT-2 plan §7 tone scan — the ONE new value-preview body string
 * (`check.history.emptyBody`) introduced by the §7.8 craft sweep, batch 2.
 * Mirrors `craft1-strings-tone.test.ts`'s forbidden-language guards
 * (CLAUDE §7 rule 1/plan tone rules): no diagnosis language, no medication/
 * dosing tokens, no outcome/health claims, no streak/pressure framing.
 */
const NEW_STRINGS: string[] = [strings.check.history.emptyBody];

const DIAGNOSIS_WORD_PATTERN = /diagnos/i;
const DOSING_PATTERN =
  /(\bmg\b|\bml\b|\bdose|dosage|milligram|per kg|administer|tablet|ibuprofen|paracetamol|acetaminophen|aspirin|benadryl|diphenhydramine|metacam|tramadol)/i;
const OUTCOME_HEALTH_CLAIM_PATTERN = /(healthy|healthier|cure|\btreat|improve|\bbetter\b|prevent)/i;
// Catches "streak"/"in a row"/"X days straight"/"don't break the chain" style
// pressure framing (CLAUDE §7 / plan tone rules -- record-only, never gamified).
const STREAK_PRESSURE_PATTERN = /(streak|don'?t break|in a row|\d+\s*days?\s*straight|keep it going|chain)/i;

describe("CRAFT-2 §7 new strings tone scan", () => {
  it("added exactly the 1 planned string (non-vacuous: the array itself is not empty)", () => {
    expect(NEW_STRINGS.length).toBe(1);
  });

  it("contains no diagnosis/diagnose language", () => {
    for (const value of NEW_STRINGS) {
      expect(DIAGNOSIS_WORD_PATTERN.test(value)).toBe(false);
    }
  });

  it("contains no medication name/dosing/administration language", () => {
    for (const value of NEW_STRINGS) {
      expect(DOSING_PATTERN.test(value)).toBe(false);
    }
  });

  it("contains no outcome/health-claim language", () => {
    for (const value of NEW_STRINGS) {
      expect(OUTCOME_HEALTH_CLAIM_PATTERN.test(value)).toBe(false);
    }
  });

  it("contains no streak/pressure framing", () => {
    for (const value of NEW_STRINGS) {
      expect(STREAK_PRESSURE_PATTERN.test(value)).toBe(false);
    }
  });

  // Non-vacuity proof: the pattern must actually catch planted streak-pressure
  // copy, not just pass because nothing in NEW_STRINGS happens to match.
  it("the streak-pressure pattern catches planted pressure copy (non-vacuity proof)", () => {
    expect(STREAK_PRESSURE_PATTERN.test("Don't break your streak!")).toBe(true);
    expect(STREAK_PRESSURE_PATTERN.test("7 days straight, keep it going!")).toBe(true);
  });
});
