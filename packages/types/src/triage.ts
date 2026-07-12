import { z } from "zod";

/**
 * TriageResult — the AI safety fail-upward floor (PRODUCT_SPEC §6.3, §5).
 *
 * This schema, `parseTriage`, and `SAFE_FALLBACK` are the deterministic gate
 * that every AI-generated triage result must pass through before it reaches
 * a caller (packages/ai, apps/api, apps/mobile). Nothing here calls a
 * provider, builds a prompt, or performs a repair retry (T031/T033/T034) —
 * this file only validates-or-rejects and supplies the safe fallback data.
 */

export const URGENCY_TIERS = ["EMERGENCY_NOW", "VET_24H", "VET_SOON", "MONITOR", "REASSURE"] as const;
export const urgencySchema = z.enum(URGENCY_TIERS);
export type Urgency = z.infer<typeof urgencySchema>;

export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export const confidenceSchema = z.enum(CONFIDENCE_LEVELS);
export type Confidence = z.infer<typeof confidenceSchema>;

/** Lower index = more urgent. EMERGENCY_NOW is the most severe tier. */
export const URGENCY_SEVERITY: Record<Urgency, number> = {
  EMERGENCY_NOW: 0,
  VET_24H: 1,
  VET_SOON: 2,
  MONITOR: 3,
  REASSURE: 4,
};

/** Home-care copy is only safe to show on these tiers (never on an emergency). */
export const HOME_CARE_ALLOWED_TIERS = ["VET_SOON", "MONITOR", "REASSURE"] as const;

/** A `low`-confidence result may never be less urgent than this tier. */
export const VET_SOON_FLOOR_SEVERITY = URGENCY_SEVERITY.VET_SOON;

export const possibleCauseSchema = z.strictObject({
  name: z.string().min(1).max(120),
  whyItFits: z.string().min(1).max(400),
});
export type PossibleCause = z.infer<typeof possibleCauseSchema>;

/** Bounded array of short user-facing strings (redFlagsToWatch/homeCare/doNot/vetQuestions). */
const boundedStrings = z.array(z.string().min(1).max(400)).max(10);

/** CLAUDE §7 rule 1, enforced mechanically at the schema boundary (R6). */
const DIAGNOSIS_WORD_PATTERN = /diagnos/i;

/**
 * Scans every user-facing string in a candidate `TriageResult` for the
 * forbidden "diagnos(is/e)" substring and raises a zod issue on the exact
 * field path for each match found. Never mutates; only adds issues.
 */
function assertNoDiagnosisLanguage(
  data: {
    summary: string;
    possibleCauses: PossibleCause[];
    redFlagsToWatch: string[];
    homeCare: string[];
    doNot: string[];
    vetQuestions: string[];
  },
  ctx: z.RefinementCtx,
): void {
  const checkField = (value: string, path: (string | number)[]): void => {
    if (DIAGNOSIS_WORD_PATTERN.test(value)) {
      ctx.addIssue({
        code: "custom",
        message: 'user-facing text must not contain "diagnosis"/"diagnose" (CLAUDE §7 rule 1)',
        path,
      });
    }
  };

  checkField(data.summary, ["summary"]);
  data.possibleCauses.forEach((cause, index) => {
    checkField(cause.name, ["possibleCauses", index, "name"]);
    checkField(cause.whyItFits, ["possibleCauses", index, "whyItFits"]);
  });
  data.redFlagsToWatch.forEach((value, index) => checkField(value, ["redFlagsToWatch", index]));
  data.homeCare.forEach((value, index) => checkField(value, ["homeCare", index]));
  data.doNot.forEach((value, index) => checkField(value, ["doNot", index]));
  data.vetQuestions.forEach((value, index) => checkField(value, ["vetQuestions", index]));
}

export const triageResultSchema = z
  .strictObject({
    urgency: urgencySchema,
    confidence: confidenceSchema,
    summary: z.string().min(1).max(600),
    possibleCauses: z.array(possibleCauseSchema).max(4),
    redFlagsToWatch: boundedStrings,
    homeCare: boundedStrings,
    doNot: boundedStrings,
    vetQuestions: boundedStrings,
    followUpHours: z.number().int().positive().max(2160).nullable(),
  })
  .superRefine((data, ctx) => {
    // (a) fail-upward floor: a low-confidence result may never be assessed
    // as less urgent than VET_SOON. REJECT — never silently auto-raise the
    // tier (PRODUCT_SPEC §5 rule 2 / plan R3).
    if (data.confidence === "low" && URGENCY_SEVERITY[data.urgency] > VET_SOON_FLOOR_SEVERITY) {
      ctx.addIssue({
        code: "custom",
        message: "a low-confidence result must be at least VET_SOON",
        path: ["urgency"],
      });
    }

    // (b) home-care copy is never safe on an emergency tier (plan R4).
    const isHomeCareAllowedTier = (HOME_CARE_ALLOWED_TIERS as readonly Urgency[]).includes(data.urgency);
    if (!isHomeCareAllowedTier && data.homeCare.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "homeCare must be empty for EMERGENCY_NOW/VET_24H",
        path: ["homeCare"],
      });
    }

    // (c) mechanical diagnosis-word gate (plan R6).
    assertNoDiagnosisLanguage(data, ctx);
  });

export type TriageResult = z.infer<typeof triageResultSchema>;

export type ParseTriageResult =
  | { ok: true; result: TriageResult }
  | { ok: false; reason: string; issues?: z.core.$ZodIssue[] };

/**
 * Pure validate-or-reject gate. Accepts either an already-parsed `unknown`
 * value or a JSON string (providers return text — AI_PROVIDERS §3).
 * NEVER throws and NEVER mutates the input; a failure always returns a
 * machine-usable `reason` built from the zod issues (path + message) so the
 * caller's repair-retry (T033) can consume it.
 */
export function parseTriage(raw: unknown): ParseTriageResult {
  let candidate: unknown = raw;

  if (typeof raw === "string") {
    try {
      candidate = JSON.parse(raw);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: `INVALID_JSON: ${message}` };
    }
  }

  const parsed = triageResultSchema.safeParse(candidate);
  if (parsed.success) {
    return { ok: true, result: parsed.data };
  }

  const reason = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  return { ok: false, reason, issues: parsed.error.issues };
}

/**
 * The deterministic fail-upward fallback (PRODUCT_SPEC §6.3, plan R9).
 * `VET_SOON` + `low` confidence, no assessment content, neutral
 * no-human-medication `doNot` line, no diagnosis/dosing language. Frozen so
 * callers cannot accidentally mutate the shared constant; self-validates
 * against `triageResultSchema` (see triage.spec.ts).
 */
const SAFE_FALLBACK_DATA: TriageResult = {
  urgency: "VET_SOON",
  confidence: "low",
  summary:
    "We can't reliably assess this from the information provided. Please contact a licensed veterinarian to have your pet checked.",
  possibleCauses: [],
  redFlagsToWatch: [],
  homeCare: [],
  doNot: ["Do not give human medications to your pet without a veterinarian's guidance."],
  vetQuestions: [],
  followUpHours: 24,
};

function deepFreeze<T>(value: T): Readonly<T> {
  Object.freeze(value);
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item as unknown));
  } else if (value !== null && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
  }
  return value;
}

export const SAFE_FALLBACK: Readonly<TriageResult> = deepFreeze(SAFE_FALLBACK_DATA);
