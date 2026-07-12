import { z } from "zod";

/**
 * FoodSafetyAnswer — the AI food/toxin fail-upward floor (PRODUCT_SPEC §5,
 * CLAUDE §7). This schema, `parseFoodSafetyAnswer`, and
 * `FOOD_SAFETY_FALLBACK` are the deterministic gate every AI-generated
 * food-safety answer must pass through before it reaches a caller
 * (packages/ai's food module). Nothing here calls a provider, builds a
 * prompt, or reads the curated toxin dataset (packages/data) — this file
 * only validates-or-rejects and supplies the safe fallback data (T035).
 */

export const FOOD_VERDICTS = ["safe", "caution", "toxic", "emergency"] as const;
export const foodVerdictSchema = z.enum(FOOD_VERDICTS);
export type FoodVerdict = z.infer<typeof foodVerdictSchema>;

/** Lower index = safer. `emergency` is the most severe verdict. */
export const FOOD_VERDICT_SEVERITY: Record<FoodVerdict, number> = {
  safe: 0,
  caution: 1,
  toxic: 2,
  emergency: 3,
};

/** CLAUDE §7 rules 1 & 2, enforced mechanically at the schema boundary. */
const DIAGNOSIS_WORD_PATTERN = /diagnos/i;
const NUMERIC_UNIT_DOSING_PATTERN = /\b\d+\s*(mg|ml|mcg|g|kg|iu)\b/i;
const MG_PER_KG_PATTERN = /mg\s*\/\s*kg/i;
const PER_BODYWEIGHT_PATTERN = /per\s+(kg|pound|lb)\b/i;

/**
 * Scans the candidate answer's `note` for forbidden diagnosis language or any
 * dosing-shaped text (a number with a mass/volume/IU unit, `mg/kg`, or a
 * "per kg/pound/lb" phrase) and raises a zod issue when found. Never mutates;
 * only adds issues. Drug **names** are not scanned for here — a toxin/med
 * name used as a warning (e.g. "ibuprofen") is permitted; only dosing
 * numbers/instructions and the word "diagnos(is/e)" are banned (plan R8).
 */
function assertNoDosingOrDiagnosis(data: { note: string }, ctx: z.RefinementCtx): void {
  const { note } = data;

  if (DIAGNOSIS_WORD_PATTERN.test(note)) {
    ctx.addIssue({
      code: "custom",
      message: 'note must not contain "diagnosis"/"diagnose" (CLAUDE §7 rule 1)',
      path: ["note"],
    });
  }

  if (
    NUMERIC_UNIT_DOSING_PATTERN.test(note) ||
    MG_PER_KG_PATTERN.test(note) ||
    PER_BODYWEIGHT_PATTERN.test(note)
  ) {
    ctx.addIssue({
      code: "custom",
      message: "note must not contain a dosing amount/unit (CLAUDE §7 rule 2)",
      path: ["note"],
    });
  }
}

export const foodSafetyAnswerSchema = z
  .strictObject({
    verdict: foodVerdictSchema,
    note: z.string().min(1).max(600),
  })
  .superRefine(assertNoDosingOrDiagnosis);

export type FoodSafetyAnswer = z.infer<typeof foodSafetyAnswerSchema>;

export type ParseFoodSafetyAnswerResult =
  | { ok: true; result: FoodSafetyAnswer }
  | { ok: false; reason: string; issues?: z.core.$ZodIssue[] };

/**
 * Pure validate-or-reject gate. Accepts either an already-parsed `unknown`
 * value or a JSON string (providers return text — AI_PROVIDERS §3). NEVER
 * throws and NEVER mutates the input; a failure always returns a
 * machine-usable `reason` built from the zod issues (path + message).
 */
export function parseFoodSafetyAnswer(raw: unknown): ParseFoodSafetyAnswerResult {
  let candidate: unknown = raw;

  if (typeof raw === "string") {
    try {
      candidate = JSON.parse(raw);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: `INVALID_JSON: ${message}` };
    }
  }

  const parsed = foodSafetyAnswerSchema.safeParse(candidate);
  if (parsed.success) {
    return { ok: true, result: parsed.data };
  }

  const reason = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  return { ok: false, reason, issues: parsed.error.issues };
}

/**
 * The deterministic fail-upward fallback (Decision R6): `caution`, never
 * `safe`, no diagnosis/dosing language. Frozen so callers cannot accidentally
 * mutate the shared constant; self-validates against `foodSafetyAnswerSchema`
 * (see food-safety.spec.ts).
 */
const FOOD_SAFETY_FALLBACK_DATA: FoodSafetyAnswer = {
  verdict: "caution",
  note:
    "We can't reliably assess whether this is safe for your pet. To be safe, avoid giving it to them and contact a licensed veterinarian, especially if they may have already eaten it.",
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

export const FOOD_SAFETY_FALLBACK: Readonly<FoodSafetyAnswer> = deepFreeze(FOOD_SAFETY_FALLBACK_DATA);
