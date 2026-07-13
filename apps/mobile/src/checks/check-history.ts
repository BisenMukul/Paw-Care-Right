import {
  INTAKE_CATEGORIES,
  SAFE_FALLBACK,
  isTerminalCheckStatus,
  type CheckResponse,
  type Urgency,
} from "@pawcareright/types";

/**
 * Pure check-history helpers (T050 plan). `deriveCheckChip` fails UPWARD
 * (CLAUDE §7 rules 4/5): a red-flag always wins to the EMERGENCY tier
 * regardless of status; a terminal check without a valid result (or
 * FALLBACK) shows `SAFE_FALLBACK.urgency` (VET_SOON) rather than a blank or
 * reassuring chip; a still-running/queued, non-red-flag check shows a
 * neutral "in progress" status chip — never an invented calmer tier. No
 * React, no side effects.
 */
export type CheckChip = { kind: "tier"; urgency: Urgency } | { kind: "status"; status: "in-progress" };

export function deriveCheckChip(item: CheckResponse): CheckChip {
  if (item.redFlag !== undefined) return { kind: "tier", urgency: "EMERGENCY_NOW" };
  if (item.result !== undefined) return { kind: "tier", urgency: item.result.urgency };
  if (isTerminalCheckStatus(item.status)) return { kind: "tier", urgency: SAFE_FALLBACK.urgency };
  return { kind: "status", status: "in-progress" };
}

/** Look up the human label from schema data; fall back to the raw id (never throws). */
export function getCategoryLabel(category: string): string {
  return INTAKE_CATEGORIES.find((c) => c.id === category)?.label ?? category;
}

/** Deterministic YYYY-MM-DD (matches the app's existing date convention; locale-free). */
export function formatCheckDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}
