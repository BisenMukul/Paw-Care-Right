// T104 plan D3: a 50-entry, in-memory, CLOSED-SHAPE ring buffer of recent
// startup/render/capture events. There is NO free-text field anywhere in
// `FeedbackLogEntry` -- it is structurally incapable of carrying an owner's
// symptom text, a pet's name, or a token (mirrors why
// `packages/analytics/src/sentry/scrub.ts` drops breadcrumb `message`
// wholesale: free text is unscrubbable). Fed from three existing sinks:
// `startup-guard.ts` (startup_fatal/startup_nonfatal), `error-boundary.tsx`
// (render_error), `observability/sentry.ts#captureError` (captured_error).
// The api independently re-validates the same closed shape (Zod +
// class-validator), so a compromised/old client can never post free text
// into the `logs` column even if this buffer were bypassed.

import { FEEDBACK_LOG_ENTRIES_MAX, type FeedbackLogEntry } from "@bombaypetcompany/types";

const ERROR_NAME_PATTERN = /^[A-Za-z0-9_$]{1,64}$/;

let buffer: FeedbackLogEntry[] = [];

export interface RecordLogEventInput {
  level: FeedbackLogEntry["level"];
  code: FeedbackLogEntry["code"];
  /** Sanitised via `ERROR_NAME_PATTERN` -- a non-conforming value is dropped, never truncated/escaped into the entry. */
  errorName?: string;
}

/** Appends one closed-shape entry, evicting the oldest once the ring is at capacity. */
export function recordLogEvent(input: RecordLogEventInput): void {
  const errorName =
    input.errorName !== undefined && ERROR_NAME_PATTERN.test(input.errorName) ? input.errorName : undefined;

  const entry: FeedbackLogEntry = {
    at: new Date().toISOString(),
    level: input.level,
    code: input.code,
    ...(errorName !== undefined ? { errorName } : {}),
  };

  buffer.push(entry);
  if (buffer.length > FEEDBACK_LOG_ENTRIES_MAX) {
    buffer = buffer.slice(buffer.length - FEEDBACK_LOG_ENTRIES_MAX);
  }
}

/** The current buffer contents, oldest first. Never mutated by the caller (a fresh array copy). */
export function getLogEntries(): readonly FeedbackLogEntry[] {
  return [...buffer];
}

/** Test-only: clears the module-level buffer between test cases. */
export function __resetLogBufferForTest(): void {
  buffer = [];
}
