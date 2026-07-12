import { SAFE_FALLBACK, type CompletedIntake, type TriageResult, type Urgency } from "@pawcareright/types";

import { applyPostRules } from "../post-rules";
import type { TextProvider } from "../providers/types";
import { evaluateRedFlags, type RedFlagIntake } from "../rules";
import { runTriage } from "../triage";
import type { TriagePetContext, TriagePromptInput } from "../triage/types";

import { scanUnsafe } from "./detector";
import type { LoadedCase } from "./types";

/** Default fake response when a case omits `fakeResponse` (plan "Default fakeResponse"). */
export function defaultFakeResponseText(): string {
  return JSON.stringify(SAFE_FALLBACK);
}

function toRedFlagIntake(caseDef: LoadedCase): RedFlagIntake {
  const { input } = caseDef;
  return {
    species: input.species,
    ...(input.sex !== undefined ? { sex: input.sex } : {}),
    ...(input.ageMonths !== undefined ? { ageMonths: input.ageMonths } : {}),
    ...(input.weightKg !== undefined ? { weightKg: input.weightKg } : {}),
    ...(input.sizeClass !== undefined ? { sizeClass: input.sizeClass } : {}),
    ...(input.signs !== undefined ? { signs: input.signs } : {}),
    ...(input.freeText !== undefined ? { freeText: input.freeText } : {}),
  };
}

function toTriagePromptInput(caseDef: LoadedCase): TriagePromptInput {
  const { input } = caseDef;
  const pet: TriagePetContext = {
    name: input.petName ?? "the pet",
    species: input.species,
    ...(input.breedLabel !== undefined ? { breedLabel: input.breedLabel } : {}),
    ...(input.sex !== undefined ? { sex: input.sex } : {}),
    ...(input.ageMonths !== undefined ? { ageMonths: input.ageMonths } : {}),
    ...(input.weightKg !== undefined ? { weightKg: input.weightKg } : {}),
  };

  const intake: CompletedIntake = {
    category: input.category ?? "other",
    answers: [],
    ...(input.freeText !== undefined ? { freeText: input.freeText } : {}),
  };

  return { pet, intake };
}

/** Raw pipeline outputs for one case, before `scoreCase` applies the case's expectations. */
export interface PipelineOutcome {
  aiTier: Urgency;
  rulesFloor: Urgency | null;
  matchedRuleIds: string[];
  finalTier: Urgency;
  source: "rules" | "ai";
  usedFallback: boolean;
  unsafeFindings: string[];
}

/**
 * Runs one eval case through the FULL pipeline (plan step 5): builds a
 * `RedFlagIntake` + minimal `CompletedIntake` from the case's lightweight
 * `input`, then composes `evaluateRedFlags` -> `runTriage` (prompt +
 * `provider` + parse/repair/fallback, T033) -> `applyPostRules` (T036) ->
 * `scanUnsafe` (T036 minimal detector).
 */
export async function runCase(caseDef: LoadedCase, provider: TextProvider): Promise<PipelineOutcome> {
  const redFlagEvaluation = evaluateRedFlags(toRedFlagIntake(caseDef));
  const rulesFloor = redFlagEvaluation.highest?.tierFloor ?? null;
  const matchedRuleIds = redFlagEvaluation.matched.map((match) => match.ruleId);

  const triageRun = await runTriage(toTriagePromptInput(caseDef), { provider });
  const aiResult: TriageResult = triageRun.result;

  const outcome = applyPostRules(aiResult, { species: caseDef.input.species, rulesFloor });
  const unsafeFindings = scanUnsafe(outcome.result);

  return {
    aiTier: aiResult.urgency,
    rulesFloor,
    matchedRuleIds,
    finalTier: outcome.finalTier,
    source: outcome.source,
    usedFallback: triageRun.status === "SAFE_FALLBACK",
    unsafeFindings,
  };
}
