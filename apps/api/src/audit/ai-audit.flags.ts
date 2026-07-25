import type { ChatSafetyIncident } from "@pawcareright/ai";

/**
 * Closed set of `AiAuditLog.detectorFlags` codes (T090 plan step 14). Every
 * string this module can produce is EITHER a literal member of this array
 * OR a `prefix:enumValue` string built from a union-typed value below —
 * never from free text (`run.failureReason`, a caught `Error.message`, or
 * chat message content).
 *
 * `CHAT_DETECTOR_GATE_CODES` mirrors `packages/ai/src/evals/detector.ts`'s
 * internal `KNOWN_CODES` (T082 D3 — content-free by construction). Not
 * imported: that name isn't exported from `packages/ai` (read-only for this
 * task), so the four literal codes are duplicated here deliberately. If
 * that list ever grows, `findingCodes` in `packages/ai` already filters any
 * non-member string out before it can ever reach a `ChatSafetyIncident`, so
 * this list only needs to stay a superset of what actually gets emitted.
 */
export const CHAT_DETECTOR_GATE_CODES = ["DOSING", "DRUG_RECOMMENDATION", "HARM_ENABLING", "DIAGNOSIS_LANGUAGE"] as const;

/** Mirrors `packages/ai`'s `PostRulesOutcome.source` union. */
export const AI_AUDIT_SOURCE_CODES = ["rules", "ai"] as const;

/** Mirrors `packages/ai`'s `ChatIncidentReason` union. */
export const CHAT_INCIDENT_REASON_CODES = ["detector_finding", "provider_error", "empty_completion"] as const;

/** Mirrors `ChatSafetyIncident.phase`'s union. */
export const CHAT_INCIDENT_PHASE_CODES = ["release", "tail", "stream"] as const;

export const AI_AUDIT_FLAG_CODES = [
  "rules_floor_applied",
  "red_flag_hit",
  "infra_fallback",
  ...AI_AUDIT_SOURCE_CODES.map((source) => `source:${source}` as const),
  ...CHAT_INCIDENT_REASON_CODES.map((reason) => `reason:${reason}` as const),
  ...CHAT_INCIDENT_PHASE_CODES.map((phase) => `phase:${phase}` as const),
  ...CHAT_DETECTOR_GATE_CODES,
] as const;

export interface BuildCheckDetectorFlagsInput {
  /**
   * Accepted (mirroring the run-outcome shape, and to make explicit — by
   * contrast — that `run.failureReason`/the caught `Error.message` are NOT
   * part of this input) but not itself re-encoded as a flag:
   * `AiAuditLog.status` is already a first-class column (see the Step 16
   * call sites), so a `status:*` flag here would be a redundant duplicate
   * of that column, not new information.
   */
  status: "OK" | "REPAIRED" | "SAFE_FALLBACK";
  source: "rules" | "ai";
  appliedRulesFloor: boolean;
  redFlagHit: boolean;
}

/**
 * Pure. Derives ONLY from `{ status, source, appliedRulesFloor, redFlagHit }`
 * — never from `run.failureReason` or a caught `Error.message` (those can
 * carry arbitrary text). The infra-fallback path never calls this function
 * at all — it contributes the fixed code `"infra_fallback"` directly at its
 * call site (`check-runner.processor.ts`).
 */
export function buildCheckDetectorFlags(input: BuildCheckDetectorFlagsInput): string[] {
  const { source, appliedRulesFloor, redFlagHit } = input;
  const flags: string[] = [`source:${source}`];
  if (appliedRulesFloor) {
    flags.push("rules_floor_applied");
  }
  if (redFlagHit) {
    flags.push("red_flag_hit");
  }
  return flags;
}

/**
 * Pure. `[]` when there is no incident (the gate released the model's own
 * text cleanly); otherwise the incident's own `reason`/`phase` (string-
 * literal unions, T082) plus its `codes` (already filtered to
 * `KNOWN_CODES`-only, content-free by construction, T082 D3) passed through
 * verbatim — never the owner message, never model text.
 */
export function buildChatDetectorFlags(incident: ChatSafetyIncident | undefined): string[] {
  if (!incident) {
    return [];
  }
  return [`reason:${incident.reason}`, `phase:${incident.phase}`, ...incident.codes];
}
