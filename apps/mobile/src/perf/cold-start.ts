/**
 * T095 plan step 12 -- cold-start budget and pure evaluation logic. Mid-tier
 * Android target, documented budget; see `docs/PERFORMANCE.md`. This module
 * is pure (no node, no RN imports) so it is trivially unit-testable and safe
 * to import from both the eventual measurement tooling and its tests.
 *
 * There is no device or emulator in the build/loop environment (T095 plan's
 * honesty ledger): this module's logic is real and unit-tested, but no
 * measurement has actually run against it here -- see
 * `docs/PERFORMANCE.md`'s Measurement log and `loop/journal.md`.
 */

/** Mid-tier Android cold-start budget (T095). Documented target; see docs/PERFORMANCE.md. */
export const COLD_START_BUDGET_MS = 2500;

export interface AmStartTiming {
  readonly totalTimeMs: number;
  readonly waitTimeMs: number;
}

const TOTAL_TIME_PATTERN = /TotalTime:\s*(\d+)/;
const WAIT_TIME_PATTERN = /WaitTime:\s*(\d+)/;

/**
 * Parses the `TotalTime`/`WaitTime` fields out of a real `adb shell am
 * start -W` block. Throws on output that does not contain a `TotalTime` --
 * never returns a fabricated 0 (T095 plan M17: a parser that silently
 * returns 0 for unparsable device output could put a fake "0 ms cold start"
 * into a journal one day).
 */
export function parseAmStartOutput(stdout: string): AmStartTiming {
  const totalMatch = TOTAL_TIME_PATTERN.exec(stdout);
  if (totalMatch === null) {
    throw new Error("parseAmStartOutput: no TotalTime found in `am start -W` output -- refusing to fabricate a measurement");
  }
  const waitMatch = WAIT_TIME_PATTERN.exec(stdout);
  if (waitMatch === null) {
    throw new Error("parseAmStartOutput: no WaitTime found in `am start -W` output -- refusing to fabricate a measurement");
  }
  return {
    totalTimeMs: Number.parseInt(totalMatch[1]!, 10),
    waitTimeMs: Number.parseInt(waitMatch[1]!, 10),
  };
}

export interface ColdStartSummary {
  readonly n: number;
  readonly medianMs: number;
  readonly minMs: number;
  readonly maxMs: number;
}

/** Throws on an empty sample list -- there is no honest summary of zero samples. */
export function summarizeColdStart(samplesMs: readonly number[]): ColdStartSummary {
  if (samplesMs.length === 0) {
    throw new Error("summarizeColdStart: cannot summarize an empty sample list");
  }
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianMs =
    sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
  return {
    n: sorted.length,
    medianMs,
    minMs: sorted[0]!,
    maxMs: sorted[sorted.length - 1]!,
  };
}

/** Judges a sample set against the single documented budget (COLD_START_BUDGET_MS). */
export function evaluateColdStart(
  samplesMs: readonly number[],
): { readonly summary: ColdStartSummary; readonly budgetMs: number; readonly pass: boolean } {
  const summary = summarizeColdStart(samplesMs);
  return {
    summary,
    budgetMs: COLD_START_BUDGET_MS,
    pass: summary.medianMs < COLD_START_BUDGET_MS,
  };
}
