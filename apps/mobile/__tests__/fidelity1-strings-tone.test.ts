import { strings } from "../src/strings";

/**
 * FIDELITY-1 plan §7 tone scan (AC2): the Care Score is a
 * routine-completeness RECORD, never a health/wellbeing verdict, and the
 * "Today" intake strip is a plain log summary. This is the safety surface
 * for both features -- CLAUDE §7 rule 1 ("never diagnosis/diagnose"), the
 * plan's own safety statement (no health/wellbeing claim, no AI claim), and
 * mirrors `craft1-strings-tone.test.ts`'s forbidden-language scan pattern.
 */
const CARE_SCORE_STRINGS: string[] = [
  strings.careScore.label,
  strings.careScore.explainer("Rex"),
  strings.careScore.bucketOnTrack,
  strings.careScore.bucketSomeToLog,
  strings.careScore.bucketCatchUp,
  strings.careScore.bucketInsufficient,
  strings.careScore.scorePlaceholder,
  strings.careScore.a11yRing("Rex"),
  // FIDELITY-2 plan §D: the deep-green hero's CTA -- same §7 scan applies.
  strings.careScore.runCheckCta,
];

const TODAY_INTAKE_STRINGS: string[] = [
  strings.activity.today.title,
  strings.activity.today.meals(0),
  strings.activity.today.meals(1),
  strings.activity.today.meals(2),
  strings.activity.today.water(0),
  strings.activity.today.water(1),
  strings.activity.today.water(2),
  strings.activity.today.walks(0),
  strings.activity.today.walks(1),
  strings.activity.today.walks(2),
  strings.activity.today.potty(0),
  strings.activity.today.potty(1),
  strings.activity.today.potty(2),
  strings.activity.today.empty,
];

const ALL_STRINGS = [...CARE_SCORE_STRINGS, ...TODAY_INTAKE_STRINGS];

const FORBIDDEN_VOCABULARY_PATTERN =
  /(health|healthy|wellbeing|well-?being|no urgent concern|urgent concern|\bAI\b|diagnos|condition|vitals|thriv|doing (great|well)|looks? great)/i;

describe("FIDELITY-1 §7 Care Score + intake vocabulary scan", () => {
  it("enumerates all careScore.* and activity.today.* strings (non-vacuous: the arrays are not empty)", () => {
    expect(CARE_SCORE_STRINGS.length).toBe(9);
    expect(TODAY_INTAKE_STRINGS.length).toBe(14);
  });

  it("contains none of the forbidden health/wellbeing/AI/diagnosis vocabulary", () => {
    for (const value of ALL_STRINGS) {
      expect(FORBIDDEN_VOCABULARY_PATTERN.test(value)).toBe(false);
    }
  });

  it("the explainer text is invariant to the score bucket -- a constant function of petName only", () => {
    const forRex = strings.careScore.explainer("Rex");
    expect(strings.careScore.explainer("Rex")).toBe(forRex);
    expect(strings.careScore.explainer("Rex")).toBe("How complete Rex's care routine is");
  });

  // Non-vacuity proof: the forbidden pattern must actually catch planted
  // "AI health score" / outcome-claim copy, not just pass because nothing in
  // ALL_STRINGS happens to match.
  it("the forbidden-vocabulary pattern catches planted health/AI-claim copy (non-vacuity proof)", () => {
    expect(FORBIDDEN_VOCABULARY_PATTERN.test("AI health score — looking healthy")).toBe(true);
  });
});
