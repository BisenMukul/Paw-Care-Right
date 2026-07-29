import { strings } from "../src/strings";

/**
 * T083 §7 tone scan over the new `strings.chat` subtree (CLAUDE §7 rule 1/2,
 * plan Safety statement 5) — mirrors `craft2-strings-tone.test.ts`'s
 * forbidden-language guards and non-vacuity proof exactly. Recursively
 * flattens every leaf of `strings.chat` (invoking function leaves with a
 * sample arg) so nested objects (`chat.empty`, `chat.blocked`, ...) are all
 * covered without hand-maintaining a flat list.
 */

type StringLeaf = string;

function flattenLeaves(node: unknown): StringLeaf[] {
  if (typeof node === "string") {
    return [node];
  }
  if (typeof node === "function") {
    return [(node as (arg: string) => string)("Bombay Pet Company")];
  }
  if (node !== null && typeof node === "object") {
    return Object.values(node as Record<string, unknown>).flatMap(flattenLeaves);
  }
  return [];
}

const CHAT_STRINGS: StringLeaf[] = flattenLeaves(strings.chat);

const DIAGNOSIS_WORD_PATTERN = /diagnos/i;
const DOSING_PATTERN =
  /(\bmg\b|\bml\b|\bdose|dosage|milligram|per kg|administer|tablet|ibuprofen|paracetamol|acetaminophen|aspirin|benadryl|diphenhydramine|metacam|tramadol)/i;
const OUTCOME_HEALTH_CLAIM_PATTERN = /(healthy|healthier|cure|\btreat|improve|\bbetter\b|prevent)/i;
const STREAK_PRESSURE_PATTERN = /(streak|don'?t break|in a row|\d+\s*days?\s*straight|keep it going|chain)/i;

describe("T083 chat strings tone scan", () => {
  it("collected a non-empty set of leaves (non-vacuous scan)", () => {
    expect(CHAT_STRINGS.length).toBeGreaterThan(0);
  });

  it("contains no diagnosis/diagnose language", () => {
    for (const value of CHAT_STRINGS) {
      expect(DIAGNOSIS_WORD_PATTERN.test(value)).toBe(false);
    }
  });

  it("contains no medication name/dosing/administration language", () => {
    for (const value of CHAT_STRINGS) {
      expect(DOSING_PATTERN.test(value)).toBe(false);
    }
  });

  it("contains no outcome/health-claim language", () => {
    for (const value of CHAT_STRINGS) {
      expect(OUTCOME_HEALTH_CLAIM_PATTERN.test(value)).toBe(false);
    }
  });

  it("contains no streak/pressure framing", () => {
    for (const value of CHAT_STRINGS) {
      expect(STREAK_PRESSURE_PATTERN.test(value)).toBe(false);
    }
  });

  // Non-vacuity proof: each pattern must actually catch planted violating
  // copy, not just pass because nothing in CHAT_STRINGS happens to match.
  it("the patterns catch planted violating copy (non-vacuity proof)", () => {
    expect(DIAGNOSIS_WORD_PATTERN.test("Here is your diagnosis")).toBe(true);
    expect(DOSING_PATTERN.test("Give 5mg of ibuprofen")).toBe(true);
    expect(OUTCOME_HEALTH_CLAIM_PATTERN.test("This will cure your pet and prevent illness")).toBe(true);
    expect(STREAK_PRESSURE_PATTERN.test("Don't break your streak!")).toBe(true);
    expect(STREAK_PRESSURE_PATTERN.test("7 days straight, keep it going!")).toBe(true);
  });

  it("home.quickActions.askChat carries no diagnosis/dosing/outcome/streak language", () => {
    const value = strings.home.quickActions.askChat;
    expect(DIAGNOSIS_WORD_PATTERN.test(value)).toBe(false);
    expect(DOSING_PATTERN.test(value)).toBe(false);
    expect(OUTCOME_HEALTH_CLAIM_PATTERN.test(value)).toBe(false);
    expect(STREAK_PRESSURE_PATTERN.test(value)).toBe(false);
  });
});
