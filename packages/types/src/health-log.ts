import { z } from "zod";

/**
 * HealthLog — a pet's health timeline entry (T063, ARCHITECTURE §3).
 *
 * `apps/api/prisma/schema.prisma`'s `enum HealthLogKind` mirrors
 * `HEALTH_LOG_KINDS` verbatim (same order, same values) — the same mirror
 * contract `check-status.ts`'s `CHECK_STATUSES` has with `enum CheckStatus`.
 *
 * ARCHITECTURE §3's authoritative HealthLog field list is exactly
 * `(id, petId, kind, valueJson, photoKeys[], occurredAt)` — it lists NO
 * `checkId`/`reminderEventId` column, so the CHECK_REF and MED_GIVEN
 * backlinks live INSIDE `valueJson`, validated by Zod at write & read
 * (plan decision 2 / risk R1) rather than as a DB foreign key.
 *
 * MED_GIVEN ships only its enum member + `valueJson` validator here; T061's
 * contract is that MED_GIVEN entries are a read-time PROJECTION of
 * `ReminderEvent(type=MEDICATION, status=DONE, completedAt)` (T064), not a
 * persisted HealthLog row written by this task (plan decision 3 / risk R2).
 *
 * Safety (CLAUDE §7 rule 2 / mirrors `Reminder.medNameAsEntered` /
 * `medDoseAsEntered`): VET_VISIT carries NO medication/dose field.
 * MED_GIVEN's `medNameAsEntered`/`medDoseAsEntered` are optional, free-text,
 * "as entered" record-only strings — no validator here suggests, requires,
 * or computes a drug name or dose.
 *
 * `parseHealthLogValue` mirrors `parseTriage`/`parseIntake` exactly: accepts
 * an object or a JSON string, never throws, fails closed on an unknown kind
 * or invalid payload.
 */

// ---- kind enum ----

export const HEALTH_LOG_KINDS = ["WEIGHT", "MEAL", "NOTE", "VET_VISIT", "MED_GIVEN", "CHECK_REF"] as const;
export const healthLogKindSchema = z.enum(HEALTH_LOG_KINDS);
export type HealthLogKind = z.infer<typeof healthLogKindSchema>;

// ---- per-kind valueJson field shapes (defined once, composed below) ----

const weightFields = {
  weightGrams: z.number().int().positive(),
};
export const weightValueSchema = z.strictObject(weightFields);
export type WeightValue = z.infer<typeof weightValueSchema>;

const mealFields = {
  note: z.string().min(1).max(280),
  portionGrams: z.number().int().positive().optional(),
};
export const mealValueSchema = z.strictObject(mealFields);
export type MealValue = z.infer<typeof mealValueSchema>;

const noteFields = {
  text: z.string().min(1).max(2000),
};
export const noteValueSchema = z.strictObject(noteFields);
export type NoteValue = z.infer<typeof noteValueSchema>;

const vetVisitFields = {
  reason: z.string().min(1).max(280),
  clinicName: z.string().min(1).max(120).optional(),
  notes: z.string().min(1).max(2000).optional(),
  costMicroUsd: z.number().int().nonnegative().optional(),
};
export const vetVisitValueSchema = z.strictObject(vetVisitFields);
export type VetVisitValue = z.infer<typeof vetVisitValueSchema>;

const medGivenFields = {
  reminderEventId: z.string().min(1),
  medNameAsEntered: z.string().min(1).max(120).optional(),
  medDoseAsEntered: z.string().min(1).max(120).optional(),
};
export const medGivenValueSchema = z.strictObject(medGivenFields);
export type MedGivenValue = z.infer<typeof medGivenValueSchema>;

// No `checkId` brand exists yet in branded-ids.ts (only `petIdSchema`); a
// plain uuid string is used per the plan's fallback instruction.
const checkRefFields = {
  checkId: z.string().uuid(),
};
export const checkRefValueSchema = z.strictObject(checkRefFields);
export type CheckRefValue = z.infer<typeof checkRefValueSchema>;

// ---- kind -> schema lookup map ----

export const HEALTH_LOG_VALUE_SCHEMAS: Record<HealthLogKind, z.ZodType> = {
  WEIGHT: weightValueSchema,
  MEAL: mealValueSchema,
  NOTE: noteValueSchema,
  VET_VISIT: vetVisitValueSchema,
  MED_GIVEN: medGivenValueSchema,
  CHECK_REF: checkRefValueSchema,
};

// ---- discriminated union (kind + value fields, single-source composed) ----

export const healthLogValueSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("WEIGHT"), ...weightFields }),
  z.strictObject({ kind: z.literal("MEAL"), ...mealFields }),
  z.strictObject({ kind: z.literal("NOTE"), ...noteFields }),
  z.strictObject({ kind: z.literal("VET_VISIT"), ...vetVisitFields }),
  z.strictObject({ kind: z.literal("MED_GIVEN"), ...medGivenFields }),
  z.strictObject({ kind: z.literal("CHECK_REF"), ...checkRefFields }),
]);
export type HealthLogValue = z.infer<typeof healthLogValueSchema>;

// ---- photoKeys shape (shared; T064's create DTO consumes this) ----

export const HEALTH_LOG_PHOTO_KEYS_MAX = 6;
export const healthLogPhotoKeysSchema = z.array(z.string().min(1)).max(HEALTH_LOG_PHOTO_KEYS_MAX);

// ---- parse gate ----

export type ParseHealthLogValueResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: string; issues?: z.core.$ZodIssue[] };

/**
 * Pure validate-or-reject gate for a HealthLog `valueJson`, mirroring
 * `parseTriage`/`parseIntake` exactly. Accepts either an already-parsed
 * `unknown` value or a JSON string. NEVER throws and NEVER mutates the
 * input; an unknown `kind` fails closed rather than throwing.
 */
export function parseHealthLogValue(kind: string, raw: unknown): ParseHealthLogValueResult {
  const schema = (HEALTH_LOG_VALUE_SCHEMAS as Record<string, z.ZodType | undefined>)[kind];
  if (!schema) {
    return { ok: false, reason: `UNKNOWN_KIND: ${kind}` };
  }

  let candidate: unknown = raw;
  if (typeof raw === "string") {
    try {
      candidate = JSON.parse(raw);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: `INVALID_JSON: ${message}` };
    }
  }

  const parsed = schema.safeParse(candidate);
  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }

  const reason = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  return { ok: false, reason, issues: parsed.error.issues };
}
