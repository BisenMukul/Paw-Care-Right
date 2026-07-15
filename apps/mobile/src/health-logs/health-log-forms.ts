import { noteValueSchema, vetVisitValueSchema, type NoteValue, type VetVisitValue } from "@pawcareright/types";

/**
 * Pure, React-free validators over the shared `packages/types` Zod schemas
 * (T066 plan decision 3 / AC "forms validate via shared schemas"). Mirrors
 * how `add-weight-form.tsx` gates on `parseDisplayToGrams`: forms call these
 * before ever calling the mutation, so a schema violation never reaches the
 * network. No medical/interpretive copy or logic lives here (CLAUDE §7).
 */

export type NoteFormError = "empty" | "tooLong";

/** Trims, rejects empty, then validates through `noteValueSchema`. */
export function validateNoteForm(text: string): { ok: true; value: NoteValue } | { ok: false; error: NoteFormError } {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "empty" };
  }

  const parsed = noteValueSchema.safeParse({ text: trimmed });
  if (!parsed.success) {
    return { ok: false, error: "tooLong" };
  }

  return { ok: true, value: parsed.data };
}

export type VetVisitFieldError = "empty" | "tooLong";

export interface VetVisitFormErrors {
  reason?: VetVisitFieldError;
  clinicName?: VetVisitFieldError;
  notes?: VetVisitFieldError;
}

export interface VetVisitFormRaw {
  reason: string;
  clinicName: string;
  notes: string;
}

/**
 * Trims all fields, omits empty optional fields (so `strictObject` +
 * `min(1)` optionals stay valid rather than failing on `""`), short-circuits
 * an empty `reason` before parsing so the "required" message is precise,
 * then validates through `vetVisitValueSchema`. Never includes
 * `costMicroUsd` in the candidate (plan decision 5).
 */
export function validateVetVisitForm(
  raw: VetVisitFormRaw,
): { ok: true; value: VetVisitValue } | { ok: false; errors: VetVisitFormErrors } {
  const reason = raw.reason.trim();
  const clinicName = raw.clinicName.trim();
  const notes = raw.notes.trim();

  if (reason.length === 0) {
    return { ok: false, errors: { reason: "empty" } };
  }

  const candidate: Record<string, string> = { reason };
  if (clinicName.length > 0) {
    candidate.clinicName = clinicName;
  }
  if (notes.length > 0) {
    candidate.notes = notes;
  }

  const parsed = vetVisitValueSchema.safeParse(candidate);
  if (!parsed.success) {
    const errors: VetVisitFormErrors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "reason" || field === "clinicName" || field === "notes") {
        errors[field] = "tooLong";
      }
    }
    return { ok: false, errors };
  }

  return { ok: true, value: parsed.data };
}
