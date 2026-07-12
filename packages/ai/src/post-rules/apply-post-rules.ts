import {
  HOME_CARE_ALLOWED_TIERS,
  URGENCY_SEVERITY,
  URGENCY_TIERS,
  type Species,
  type TriageResult,
  type Urgency,
} from "@pawcareright/types";

/**
 * Post-rules composition (T036 — §5-critical, see plan "Post-rules
 * semantics"). Composes the AI-derived `TriageResult` with the deterministic
 * rules-engine floor and the fail-upward safety biases (cat one-tier-up,
 * confidence floor). Every step only ever RAISES urgency (lowers severity
 * number) — this function never lowers a tier and never falls back to
 * `SAFE_FALLBACK` on its own output (that would risk lowering a rules
 * EMERGENCY floor). Pure, synchronous, never throws (T043 imports this into
 * a BullMQ worker).
 */

export interface PostRulesContext {
  species: Species;
  /** = evaluateRedFlags(intake).highest?.tierFloor ?? null */
  rulesFloor: Urgency | null;
}

export interface PostRulesOutcome {
  /** Schema-valid BY CONSTRUCTION (parseTriage(result).ok === true). */
  result: TriageResult;
  finalTier: Urgency;
  appliedConfidenceFloor: boolean;
  appliedCatBias: boolean;
  appliedRulesFloor: boolean;
  strippedHomeCare: boolean;
  source: "rules" | "ai";
}

/** Lower index = more urgent (mirrors URGENCY_SEVERITY). */
function sev(tier: Urgency): number {
  return URGENCY_SEVERITY[tier];
}

/** Returns whichever of `a`/`b` is the more urgent (lower-severity) tier. Ties favor `a`. */
function moreUrgent(a: Urgency, b: Urgency): Urgency {
  return sev(a) <= sev(b) ? a : b;
}

/**
 * Raises `tier` by exactly one severity step (no-op at EMERGENCY_NOW).
 * `URGENCY_TIERS` is ordered most->least urgent, so severity === index.
 * Guarded against `noUncheckedIndexedAccess` — falls back to `tier` itself
 * in the (unreachable, given the `sev(tier) === 0` guard) case the computed
 * index is out of bounds.
 */
function raiseOne(tier: Urgency): Urgency {
  const severity = sev(tier);
  if (severity === 0) return tier;
  return URGENCY_TIERS[severity - 1] ?? tier;
}

const HOME_CARE_ALLOWED = HOME_CARE_ALLOWED_TIERS as readonly Urgency[];

/**
 * Composes the AI result with the safety floors, in order:
 * 1. confidence floor (defensive; parseTriage already guarantees this for
 *    provider-sourced results, kept here for T043's non-parseTriage inputs
 *    and for idempotency on an already-composed result).
 * 2. cat one-tier-up bias (§5 rule 2).
 * 3. rules tier floor, which can only raise urgency, never lower it (§5 rule 3).
 * 4. homeCare escalation strip (schema invariant preserved by construction).
 */
export function applyPostRules(aiResult: TriageResult, ctx: PostRulesContext): PostRulesOutcome {
  let tier: Urgency = aiResult.urgency;

  const appliedConfidenceFloor = aiResult.confidence === "low" && sev(tier) > sev("VET_SOON");
  if (appliedConfidenceFloor) {
    tier = "VET_SOON";
  }

  let appliedCatBias = false;
  if (ctx.species === "CAT") {
    const raised = raiseOne(tier);
    appliedCatBias = raised !== tier;
    tier = raised;
  }

  let appliedRulesFloor = false;
  if (ctx.rulesFloor !== null) {
    const floored = moreUrgent(tier, ctx.rulesFloor);
    appliedRulesFloor = floored !== tier;
    tier = floored;
  }

  const source: "rules" | "ai" = appliedRulesFloor ? "rules" : "ai";

  const homeCareAllowed = HOME_CARE_ALLOWED.includes(tier);
  const homeCare = homeCareAllowed ? aiResult.homeCare : [];
  const strippedHomeCare = homeCare !== aiResult.homeCare && aiResult.homeCare.length > 0;

  const result: TriageResult = { ...aiResult, urgency: tier, homeCare };

  return {
    result,
    finalTier: tier,
    appliedConfidenceFloor,
    appliedCatBias,
    appliedRulesFloor,
    strippedHomeCare,
    source,
  };
}
