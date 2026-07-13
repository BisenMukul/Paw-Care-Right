import type { CheckStatus } from "@pawcareright/types";

/**
 * `SymptomCheck.status` transition contract (T041 card, verbatim):
 * "QUEUED -> RUNNING -> DONE|FALLBACK only". Pure, framework-free (no
 * Nest/Prisma imports) so T042/T043 can call it from a controller, a
 * service, or a BullMQ worker without a Nest test module.
 *
 * Legal edges — exactly these three:
 *   QUEUED  -> RUNNING
 *   RUNNING -> DONE
 *   RUNNING -> FALLBACK
 *
 * Everything else is illegal: self-edges/no-ops, backward edges, the
 * skip-state edges QUEUED->DONE / QUEUED->FALLBACK (see plan R4 — a check
 * must be RUNNING before it can FALLBACK), and any edge out of a terminal
 * state (DONE, FALLBACK).
 */
export const CHECK_STATUS_TRANSITIONS: Readonly<Record<CheckStatus, readonly CheckStatus[]>> = {
  QUEUED: ["RUNNING"],
  RUNNING: ["DONE", "FALLBACK"],
  DONE: [],
  FALLBACK: [],
};

/** Terminal states: no legal outgoing edge (N2 — FALLBACK must stay terminal). */
export const TERMINAL_CHECK_STATUSES: readonly CheckStatus[] = ["DONE", "FALLBACK"];

/** Returns whether `from -> to` is one of the three legal edges. */
export function canTransition(from: CheckStatus, to: CheckStatus): boolean {
  const legalTargets = CHECK_STATUS_TRANSITIONS[from];
  return legalTargets.includes(to);
}

/**
 * Throws a plain `Error` (no Nest exception types — this file stays pure)
 * when `from -> to` is not a legal edge. Void return on a legal edge.
 */
export function assertTransition(from: CheckStatus, to: CheckStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`illegal SymptomCheck status transition: ${from} -> ${to}`);
  }
}

/** `true` for `DONE`/`FALLBACK`, `false` for `QUEUED`/`RUNNING`. */
export function isTerminalCheckStatus(status: CheckStatus): boolean {
  return TERMINAL_CHECK_STATUSES.includes(status);
}
