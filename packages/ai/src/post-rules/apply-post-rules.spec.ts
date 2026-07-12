import {
  CONFIDENCE_LEVELS,
  parseTriage,
  SAFE_FALLBACK,
  URGENCY_SEVERITY,
  URGENCY_TIERS,
  type Confidence,
  type TriageResult,
  type Urgency,
} from "@pawcareright/types";

import { applyPostRules, type PostRulesContext } from "./apply-post-rules";

function baseResult(overrides: Partial<TriageResult> = {}): TriageResult {
  return {
    urgency: "REASSURE",
    confidence: "high",
    summary: "A single vomit in an otherwise bright, playful dog is usually not concerning.",
    possibleCauses: [],
    redFlagsToWatch: [],
    homeCare: [],
    doNot: ["Do not give human medications to your pet."],
    vetQuestions: [],
    followUpHours: 24,
    ...overrides,
  };
}

/** Builds a schema-valid `TriageResult` for `tier`/`confidence`, with a non-empty `homeCare` when the tier allows it (so escalation-strip is observable). */
function resultFor(tier: Urgency, confidence: Confidence): TriageResult {
  const homeCareAllowed = tier === "VET_SOON" || tier === "MONITOR" || tier === "REASSURE";
  return baseResult({
    urgency: tier,
    confidence,
    homeCare: homeCareAllowed ? ["Offer a small bland meal later today"] : [],
  });
}

describe("applyPostRules", () => {
  it("rules EMERGENCY_NOW floor beats AI REASSURE(+homeCare): escalates, strips homeCare, source rules", () => {
    const ai = resultFor("REASSURE", "high");
    const ctx: PostRulesContext = { species: "DOG", rulesFloor: "EMERGENCY_NOW" };

    const outcome = applyPostRules(ai, ctx);

    expect(outcome.finalTier).toBe("EMERGENCY_NOW");
    expect(outcome.result.urgency).toBe("EMERGENCY_NOW");
    expect(outcome.result.homeCare).toEqual([]);
    expect(outcome.strippedHomeCare).toBe(true);
    expect(outcome.source).toBe("rules");
    expect(outcome.appliedRulesFloor).toBe(true);
    expect(parseTriage(outcome.result).ok).toBe(true);
  });

  it("cat + AI VET_SOON(+homeCare) => VET_24H, homeCare stripped, source ai, appliedCatBias true", () => {
    const ai = resultFor("VET_SOON", "medium");
    const ctx: PostRulesContext = { species: "CAT", rulesFloor: null };

    const outcome = applyPostRules(ai, ctx);

    expect(outcome.finalTier).toBe("VET_24H");
    expect(outcome.result.homeCare).toEqual([]);
    expect(outcome.strippedHomeCare).toBe(true);
    expect(outcome.source).toBe("ai");
    expect(outcome.appliedCatBias).toBe(true);
    expect(outcome.appliedRulesFloor).toBe(false);
    expect(parseTriage(outcome.result).ok).toBe(true);
  });

  it("cat + AI REASSURE(+homeCare) => MONITOR, homeCare kept (MONITOR is a home-care tier), appliedCatBias true", () => {
    const ai = resultFor("REASSURE", "high");
    const ctx: PostRulesContext = { species: "CAT", rulesFloor: null };

    const outcome = applyPostRules(ai, ctx);

    expect(outcome.finalTier).toBe("MONITOR");
    expect(outcome.result.homeCare).toEqual(ai.homeCare);
    expect(outcome.strippedHomeCare).toBe(false);
    expect(outcome.source).toBe("ai");
    expect(outcome.appliedCatBias).toBe(true);
    expect(parseTriage(outcome.result).ok).toBe(true);
  });

  it("dog + AI REASSURE, no rules floor => unchanged REASSURE, source ai", () => {
    const ai = resultFor("REASSURE", "high");
    const ctx: PostRulesContext = { species: "DOG", rulesFloor: null };

    const outcome = applyPostRules(ai, ctx);

    expect(outcome.finalTier).toBe("REASSURE");
    expect(outcome.result).toEqual(ai);
    expect(outcome.source).toBe("ai");
    expect(outcome.appliedCatBias).toBe(false);
    expect(outcome.appliedRulesFloor).toBe(false);
    expect(outcome.strippedHomeCare).toBe(false);
    expect(parseTriage(outcome.result).ok).toBe(true);
  });

  it("cat + SAFE_FALLBACK (VET_SOON/low, empty homeCare) => VET_24H, no strip (homeCare already empty)", () => {
    const ctx: PostRulesContext = { species: "CAT", rulesFloor: null };

    const outcome = applyPostRules(SAFE_FALLBACK, ctx);

    expect(outcome.finalTier).toBe("VET_24H");
    expect(outcome.result.homeCare).toEqual([]);
    expect(outcome.strippedHomeCare).toBe(false);
    expect(outcome.appliedCatBias).toBe(true);
    expect(parseTriage(outcome.result).ok).toBe(true);
  });

  it("rulesFloor equal to AI tier => appliedRulesFloor false, source ai (documented tie behavior)", () => {
    const ai = resultFor("VET_SOON", "medium");
    const ctx: PostRulesContext = { species: "DOG", rulesFloor: "VET_SOON" };

    const outcome = applyPostRules(ai, ctx);

    expect(outcome.finalTier).toBe("VET_SOON");
    expect(outcome.appliedRulesFloor).toBe(false);
    expect(outcome.source).toBe("ai");
    expect(parseTriage(outcome.result).ok).toBe(true);
  });

  it("confidence floor is idempotent: low-confidence REASSURE-tier input (defensive, non-parseTriage path) floors to VET_SOON once", () => {
    // Bypasses parseTriage's own low-confidence gate on purpose: this models
    // T043's non-parseTriage inputs (plan "Post-rules semantics" step 1 note).
    const ai = baseResult({ urgency: "REASSURE", confidence: "low", homeCare: [] });
    const ctx: PostRulesContext = { species: "DOG", rulesFloor: null };

    const outcome = applyPostRules(ai, ctx);

    expect(outcome.finalTier).toBe("VET_SOON");
    expect(outcome.appliedConfidenceFloor).toBe(true);

    // Re-applying to the already-floored result is a no-op: VET_SOON is not
    // strictly more urgent than the VET_SOON floor, so no further floor is applied.
    const second = applyPostRules(outcome.result, ctx);
    expect(second.finalTier).toBe("VET_SOON");
    expect(second.appliedConfidenceFloor).toBe(false);
    expect(parseTriage(outcome.result).ok).toBe(true);
    expect(parseTriage(second.result).ok).toBe(true);
  });

  describe("validity-by-construction matrix", () => {
    const species: PostRulesContext["species"][] = ["DOG", "CAT"];
    const rulesFloors: (Urgency | null)[] = [null, "EMERGENCY_NOW", "VET_SOON"];

    function isValidConfidenceForTier(tier: Urgency, confidence: Confidence): boolean {
      if (confidence !== "low") return true;
      return URGENCY_SEVERITY[tier] <= URGENCY_SEVERITY.VET_SOON;
    }

    for (const tier of URGENCY_TIERS) {
      for (const confidence of CONFIDENCE_LEVELS) {
        if (!isValidConfidenceForTier(tier, confidence)) continue;

        for (const sp of species) {
          for (const rulesFloor of rulesFloors) {
            it(`tier=${tier} confidence=${confidence} species=${sp} rulesFloor=${rulesFloor ?? "null"} => valid & never lowers`, () => {
              const ai = resultFor(tier, confidence);
              const ctx: PostRulesContext = { species: sp, rulesFloor };

              const outcome = applyPostRules(ai, ctx);

              expect(parseTriage(outcome.result).ok).toBe(true);
              expect(URGENCY_SEVERITY[outcome.finalTier]).toBeLessThanOrEqual(URGENCY_SEVERITY[tier]);
            });
          }
        }
      }
    }
  });
});
