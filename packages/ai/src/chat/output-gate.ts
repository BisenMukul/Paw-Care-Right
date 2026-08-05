import { findingCodes, scanUnsafeText } from "../evals/detector";
import type { TextStreamChunk } from "../providers/types";

/**
 * Shared chat output gate (T082 plan D1/F3 fix). Moves the release/scan
 * consumption loop OUT of `apps/api/src/chat/chat.service.ts` and into
 * `packages/ai` so both the API and the chat eval pipeline
 * (`evals/chat-pipeline.ts`) consume the SAME gate — no fork of a safety
 * path. `endsAtBoundary`/`shouldRelease` are moved VERBATIM from the T081
 * `chat.service.ts`. The gate is pure except for consuming the caller's
 * async iterable: no clock, no I/O, no logging, and `runGatedStream` never
 * throws out of itself (every provider/transport error converges on
 * `SAFE_FALLBACK` via the same try/catch as every other failure mode).
 */

/** Max un-released buffer (chars) before a forced boundary scan+release, even absent a sentence boundary. */
export const CHAT_RELEASE_BOUNDARY_CHARS = 160;

/**
 * F3 fix: every scan window is `lastReleasedTail(128) + pending`, never
 * `pending` alone, so a pattern straddling a forced release boundary is
 * always caught. Sized from the T038 pattern set's widest match span
 * (`HARM_B` ~= PROC (<=~21) + `[a-z]*` (~10) + the `{0,40}` bridge + DIY
 * (<=22) ~= 93 chars; `HARM_A` ~= 83; `DOSE_FREQ_A/B` ~= 73), with headroom,
 * and pinned by an explicit lower-bound assertion in `output-gate.spec.ts`
 * so a future reduction breaks a test.
 */
export const CHAT_SCAN_OVERLAP_CHARS = 128;

export type ChatIncidentReason = "detector_finding" | "provider_error" | "empty_completion";

/**
 * Content-free by construction (T082 plan D3/Safety statement 5): carries
 * finding CODES only — never excerpts, never the owner message, never model
 * text. The excerpt-bearing `scanUnsafeText` findings never reach this shape.
 */
export interface ChatSafetyIncident {
  reason: ChatIncidentReason;
  /** `findingCodes(...)` — CODES ONLY, never excerpts or model text. */
  codes: string[];
  phase: "release" | "tail" | "stream";
  /** Model chars seen when the incident was raised. */
  charsScanned: number;
  /** Model chars already emitted to the client. */
  releasedChars: number;
  releasedBeforeFlag: boolean;
}

export type GateStep =
  | { kind: "hold" }
  | { kind: "release"; text: string }
  | { kind: "flag"; incident: ChatSafetyIncident };

function endsAtBoundary(text: string): boolean {
  return text.endsWith("\n") || text.endsWith(". ") || text.endsWith("! ") || text.endsWith("? ");
}

function shouldRelease(pending: string): boolean {
  return pending.length > 0 && (endsAtBoundary(pending) || pending.length > CHAT_RELEASE_BOUNDARY_CHARS);
}

/**
 * Buffer-then-release gate with an overlap-scanned boundary (T082 F3 fix).
 *
 * Double-scan / double-report argument (must appear as a comment in the
 * module): every scan window strictly contains the text it releases, and
 * `releasedTail` retains the last 128 chars of everything released so far.
 * Any match lying entirely inside the released region was already inside
 * some earlier scan window: a match inside segment p_i was inside W_i; a
 * match straddling p_i|p_{i+1} has span <= 93 (D2) <= 128, so its p_i part
 * sits within the tail carried into W_{i+1}. Since every earlier scan
 * returned clean, a later finding necessarily involves at least one
 * character of the current `pending` -- so no already-cleared text can be
 * re-reported. And because `flagged` latches on the first finding and the
 * consumer breaks immediately, at most one incident is ever produced per
 * stream, regardless.
 */
export class ChatOutputGate {
  private pending = "";
  private releasedTail = "";
  private _releasedChars = 0;
  private _seenChars = 0;
  private _flagged = false;

  get releasedChars(): number {
    return this._releasedChars;
  }

  get seenChars(): number {
    return this._seenChars;
  }

  get flagged(): boolean {
    return this._flagged;
  }

  push(delta: string): GateStep {
    if (this._flagged) {
      // Defensive latch — the consumer already stopped, but a caller that
      // ignores a `flag` step and keeps pushing must never resume release.
      return { kind: "hold" };
    }

    this._seenChars += delta.length;
    this.pending += delta;

    if (!shouldRelease(this.pending)) {
      return { kind: "hold" };
    }

    return this.scanAndRelease("release");
  }

  finish(): GateStep {
    if (this._flagged || this.pending.length === 0) {
      return { kind: "hold" };
    }

    return this.scanAndRelease("tail");
  }

  private scanAndRelease(phase: "release" | "tail"): GateStep {
    // The overlap scan (F3 fix): the window strictly contains the tail of
    // everything already released PLUS the newly-pending text, so a pattern
    // straddling a prior forced-release boundary is always caught.
    const findings = scanUnsafeText(this.releasedTail + this.pending);

    if (findings.length > 0) {
      this._flagged = true;
      this.pending = "";
      // No positional filtering: a finding whose match lies partly or
      // wholly inside `releasedTail` still flags. `releasedBeforeFlag` is
      // observability only -- it never changes the decision.
      return {
        kind: "flag",
        incident: {
          reason: "detector_finding",
          codes: findingCodes(findings),
          phase,
          charsScanned: this._seenChars,
          releasedChars: this._releasedChars,
          releasedBeforeFlag: this._releasedChars > 0,
        },
      };
    }

    const text = this.pending;
    this._releasedChars += text.length;
    this.releasedTail = (this.releasedTail + text).slice(-CHAT_SCAN_OVERLAP_CHARS);
    this.pending = "";
    return { kind: "release", text };
  }
}

export interface GatedStreamHandlers {
  /** The ONLY egress for model text. */
  emit: (text: string) => void;
  shouldAbort?: () => boolean;
}

export interface GatedStreamResult {
  status: "OK" | "SAFE_FALLBACK";
  aborted: boolean;
  deliveredChars: number;
  incident: ChatSafetyIncident | null;
  /** Provider/transport error text only -- never model output. */
  providerErrorMessage?: string;
}

/**
 * The shared consumption loop (T082 D1): reads `source` delta by delta,
 * feeding each into a fresh {@link ChatOutputGate}, emitting only
 * gate-released text via `handlers.emit`, and converging every failure mode
 * (detector finding, client abort, empty completion, provider error) on the
 * same `SAFE_FALLBACK` status. Never emits the fallback sentence itself (the
 * caller owns SSE/user-facing text) and never returns finding excerpts or
 * model text.
 */
export async function runGatedStream(
  source: AsyncIterable<TextStreamChunk>,
  handlers: GatedStreamHandlers,
): Promise<GatedStreamResult> {
  const gate = new ChatOutputGate();
  let status: "OK" | "SAFE_FALLBACK" = "OK";
  let incident: ChatSafetyIncident | null = null;
  let aborted = false;
  let providerErrorMessage: string | undefined;

  try {
    for await (const delta of source) {
      if (handlers.shouldAbort?.()) {
        aborted = true;
        break;
      }

      const step = gate.push(delta.text);
      if (step.kind === "flag") {
        status = "SAFE_FALLBACK";
        incident = step.incident;
        break;
      } else if (step.kind === "release") {
        handlers.emit(step.text);
      }
    }

    if (status === "OK" && !aborted) {
      const step = gate.finish();
      if (step.kind === "flag") {
        status = "SAFE_FALLBACK";
        incident = step.incident;
      } else if (step.kind === "release") {
        handlers.emit(step.text);
      }
    }

    if (status === "OK" && !aborted && gate.releasedChars === 0) {
      // Stream ended with zero released text — fail upward, never silently guess.
      status = "SAFE_FALLBACK";
      incident = {
        reason: "empty_completion",
        codes: [],
        phase: "stream",
        charsScanned: gate.seenChars,
        releasedChars: 0,
        releasedBeforeFlag: false,
      };
    }
  } catch (err) {
    status = "SAFE_FALLBACK";
    providerErrorMessage = err instanceof Error ? err.message : String(err);
    incident = {
      reason: "provider_error",
      codes: [],
      phase: "stream",
      charsScanned: gate.seenChars,
      releasedChars: gate.releasedChars,
      releasedBeforeFlag: gate.releasedChars > 0,
    };
  }

  return {
    status,
    aborted,
    deliveredChars: gate.releasedChars,
    incident,
    ...(providerErrorMessage !== undefined ? { providerErrorMessage } : {}),
  };
}
