import {
  getCategoryDef,
  raiseUrgency,
  type Answer,
  type CompletedIntake,
  type FollowUpResponse,
  type SymptomCategory,
  type TriageResult,
  type Urgency,
} from "@pawcareright/types";

import { daysAgo } from "../clock";
import { DEMO_MODEL_ID, DEMO_PROMPT_VERSION } from "../constants";
import {
  TRIAGE_EMERGENCY,
  TRIAGE_FALLBACK,
  TRIAGE_MONITOR,
  TRIAGE_REASSURE,
  TRIAGE_VET_24H,
  TRIAGE_VET_SOON,
} from "../content";

export interface DemoCheckResultInput {
  urgency: Urgency;
  confidence: string;
  resultJson: TriageResult;
  modelId: string;
  promptVersion: string;
}

export interface DemoCheckInput {
  petId: string;
  createdById: string;
  status: "DONE" | "FALLBACK";
  category: string;
  intake: CompletedIntake;
  redFlagHit: boolean;
  redFlagRuleId: string | null;
  redFlagPayloadKey: string | null;
  failureReason: string | null;
  createdAt: Date;
  completedAt: Date;
  result: DemoCheckResultInput;
  followUp?: { response: FollowUpResponse; escalatedTier: Urgency | null };
}

/**
 * Deterministically answers every REQUIRED question in `categoryId` with
 * the question's first option (single/multi), its scale minimum, or its
 * first offered duration unit — always producing a schema-valid
 * `CompletedIntake` (`parseIntake` re-asserted by `demo-builders.spec.ts`).
 * Optional questions are left unanswered, which the schema permits. Pure,
 * no randomness; `categoryId` is always one of our own `SYMPTOM_CATEGORIES`
 * literals, so the category is always found.
 */
function buildMinimalIntake(categoryId: SymptomCategory): CompletedIntake {
  const category = getCategoryDef(categoryId);
  /* istanbul ignore next -- defensive; categoryId is always a valid literal below */
  if (!category) {
    throw new Error(`demo seed: unknown intake category "${categoryId}"`);
  }

  const answers: Answer[] = [];
  for (const question of category.questions) {
    if (!question.required) continue;

    if (question.type === "single") {
      answers.push({ questionId: question.id, type: "single", value: question.options[0].value });
    } else if (question.type === "multi") {
      answers.push({ questionId: question.id, type: "multi", values: [question.options[0].value] });
    } else if (question.type === "scale") {
      answers.push({ questionId: question.id, type: "scale", value: question.min });
    } else if (question.type === "duration") {
      answers.push({ questionId: question.id, type: "duration", value: 1, unit: question.units[0] });
    } else {
      answers.push({ questionId: question.id, type: "photoPrompt", photoKeys: [] });
    }
  }

  return { category: categoryId, answers };
}

function toResult(triage: TriageResult): DemoCheckResultInput {
  return {
    urgency: triage.urgency,
    confidence: triage.confidence,
    resultJson: triage,
    modelId: DEMO_MODEL_ID,
    promptVersion: DEMO_PROMPT_VERSION,
  };
}

/**
 * 6 checks (plan #8): every urgency tier, exactly one FALLBACK-status
 * check, and exactly one red-flag `EMERGENCY_NOW` check (`ruleId` ===
 * `payloadKey` === `"gdv-suspected"`, one of the 22 pinned
 * `EMERGENCY_PAYLOAD_ROWS`). Buddy gets "all check tiers" (REASSURE,
 * MONITOR + a "better" follow-up, VET_24H, the red-flag EMERGENCY_NOW);
 * Cleo gets "a couple checks" (VET_SOON + a "worse" follow-up that
 * escalates by one tier, and the FALLBACK). `createdAt` spreads over ~5
 * weeks.
 */
export function buildChecks(now: Date, ids: { buddyId: string; cleoId: string; createdById: string }): DemoCheckInput[] {
  const { buddyId, cleoId, createdById } = ids;

  return [
    {
      petId: buddyId,
      createdById,
      status: "DONE",
      category: "vomiting",
      intake: buildMinimalIntake("vomiting"),
      redFlagHit: false,
      redFlagRuleId: null,
      redFlagPayloadKey: null,
      failureReason: null,
      createdAt: daysAgo(now, 35),
      completedAt: daysAgo(now, 35),
      result: toResult(TRIAGE_REASSURE),
    },
    {
      petId: buddyId,
      createdById,
      status: "DONE",
      category: "skin-itch",
      intake: buildMinimalIntake("skin-itch"),
      redFlagHit: false,
      redFlagRuleId: null,
      redFlagPayloadKey: null,
      failureReason: null,
      createdAt: daysAgo(now, 28),
      completedAt: daysAgo(now, 28),
      result: toResult(TRIAGE_MONITOR),
      followUp: { response: "better", escalatedTier: null },
    },
    {
      petId: buddyId,
      createdById,
      status: "DONE",
      category: "breathing",
      intake: buildMinimalIntake("breathing"),
      redFlagHit: false,
      redFlagRuleId: null,
      redFlagPayloadKey: null,
      failureReason: null,
      createdAt: daysAgo(now, 21),
      completedAt: daysAgo(now, 21),
      result: toResult(TRIAGE_VET_24H),
    },
    {
      petId: buddyId,
      createdById,
      status: "DONE",
      category: "vomiting",
      intake: buildMinimalIntake("vomiting"),
      redFlagHit: true,
      redFlagRuleId: "gdv-suspected",
      redFlagPayloadKey: "gdv-suspected",
      failureReason: null,
      createdAt: daysAgo(now, 14),
      completedAt: daysAgo(now, 14),
      result: toResult(TRIAGE_EMERGENCY),
    },
    {
      petId: cleoId,
      createdById,
      status: "DONE",
      category: "not-eating",
      intake: buildMinimalIntake("not-eating"),
      redFlagHit: false,
      redFlagRuleId: null,
      redFlagPayloadKey: null,
      failureReason: null,
      createdAt: daysAgo(now, 7),
      completedAt: daysAgo(now, 7),
      result: toResult(TRIAGE_VET_SOON),
      followUp: { response: "worse", escalatedTier: raiseUrgency(TRIAGE_VET_SOON.urgency) },
    },
    {
      petId: cleoId,
      createdById,
      status: "FALLBACK",
      category: "limping",
      intake: buildMinimalIntake("limping"),
      redFlagHit: false,
      redFlagRuleId: null,
      redFlagPayloadKey: null,
      failureReason: "PROVIDER_ERROR",
      createdAt: daysAgo(now, 1),
      completedAt: daysAgo(now, 1),
      result: toResult(TRIAGE_FALLBACK),
    },
  ];
}
