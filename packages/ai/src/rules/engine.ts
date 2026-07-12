import { URGENCY_SEVERITY } from "@pawcareright/types";

import { matchesKeywordLeaf, normalizeText } from "./normalize";
import { RED_FLAG_RULES } from "./rules-table";
import type {
  IntakePredicate,
  KeywordLeaf,
  Matcher,
  RedFlagEvaluation,
  RedFlagIntake,
  RedFlagMatch,
  RedFlagRule,
} from "./types";

/**
 * The deterministic red-flag evaluator (SPEC §5 rule 3). Pure, synchronous,
 * zero provider imports — this is the layer that short-circuits to the
 * Emergency interstitial BEFORE any AI runs.
 */

function isKeywordLeaf(matcher: Matcher): matcher is KeywordLeaf {
  return typeof matcher === "object" && matcher !== null && "kw" in matcher;
}

function isAllOf(matcher: Matcher): matcher is { allOf: readonly Matcher[] } {
  return typeof matcher === "object" && matcher !== null && "allOf" in matcher;
}

function isAnyOf(matcher: Matcher): matcher is { anyOf: readonly Matcher[] } {
  return typeof matcher === "object" && matcher !== null && "anyOf" in matcher;
}

/** Evaluates a single leaf `IntakePredicate` against the intake (plan "Matcher semantics"). */
function evalPredicate(predicate: IntakePredicate, intake: RedFlagIntake): boolean {
  switch (predicate.field) {
    case "species":
      return predicate.op === "eq" ? intake.species === predicate.value : predicate.value.includes(intake.species);
    case "sex":
      // Fail-upward: undefined/unknown sex still matches (plan R6).
      return intake.sex === undefined || predicate.value.includes(intake.sex);
    case "ageMonths": {
      if (intake.ageMonths === undefined) return false;
      return predicate.op === "lte" ? intake.ageMonths <= predicate.value : intake.ageMonths >= predicate.value;
    }
    case "weightKg": {
      if (intake.weightKg === undefined) return false;
      return predicate.op === "lte" ? intake.weightKg <= predicate.value : intake.weightKg >= predicate.value;
    }
    case "sign":
      return intake.signs?.[predicate.sign] === true;
  }
}

/** Recursively evaluates a `Matcher` (leaf predicate, keyword leaf, or allOf/anyOf combinator). */
function evalMatcher(matcher: Matcher, intake: RedFlagIntake, normalizedText: string): boolean {
  if (isKeywordLeaf(matcher)) {
    return matchesKeywordLeaf(normalizedText, matcher.kw);
  }
  if (isAllOf(matcher)) {
    return matcher.allOf.every((child) => evalMatcher(child, intake, normalizedText));
  }
  if (isAnyOf(matcher)) {
    return matcher.anyOf.some((child) => evalMatcher(child, intake, normalizedText));
  }
  return evalPredicate(matcher, intake);
}

function speciesGatePasses(rule: RedFlagRule, intake: RedFlagIntake): boolean {
  return rule.species === "ANY" || rule.species === intake.species;
}

function toMatch(rule: RedFlagRule): RedFlagMatch {
  return {
    ruleId: rule.id,
    species: rule.species,
    tierFloor: rule.tierFloor,
    emergencyPayloadKey: rule.emergencyPayloadKey,
    label: rule.label,
  };
}

/**
 * Evaluates ALL rules in `RED_FLAG_RULES` against `intake` (never
 * short-circuits the table — every rule gets a chance to fire), collects
 * every match, and sorts by urgency severity (most urgent first) with a
 * stable tie-break by table declaration order.
 */
export function evaluateRedFlags(intake: RedFlagIntake): RedFlagEvaluation {
  const normalizedText = normalizeText(intake.freeText ?? "");

  const matched: RedFlagMatch[] = RED_FLAG_RULES.filter(
    (rule) => speciesGatePasses(rule, intake) && evalMatcher(rule.match, intake, normalizedText),
  ).map(toMatch);

  // Stable sort by severity ascending (0 = most urgent); `Array.prototype.sort`
  // is spec-guaranteed stable in modern JS engines, preserving table order
  // for equal severities (plan "Matcher semantics").
  matched.sort((a, b) => URGENCY_SEVERITY[a.tierFloor] - URGENCY_SEVERITY[b.tierFloor]);

  return { matched, highest: matched[0] ?? null };
}
