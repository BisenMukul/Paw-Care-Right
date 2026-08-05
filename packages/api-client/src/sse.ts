/**
 * Pure SSE (Server-Sent Events) frame parser (T083 plan decision D2/D1).
 * Mirrors the wire format written by the API's `SseWriter`
 * (`apps/api/src/chat/sse-writer.ts:38`):
 *
 *   res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
 *
 * No I/O, no timers, never throws — frames are just text in, frames out.
 * Platform-agnostic (no `expo`/DOM import) so it's reusable/unit-testable
 * from this package's plain node/ts-jest suite, and so `apps/web` (which has
 * no chat feature) never pulls in anything chat-specific by importing this
 * generic parser.
 */

export interface SseFrame {
  /** The `event:` field value; `"message"` when the frame carried no event line (SSE default). */
  event: string;
  /** The concatenation of all `data:` lines, joined with "\n" (raw text, NOT parsed). */
  data: string;
}

export interface SseFrameParser {
  /** Feeds one decoded text chunk; returns every COMPLETE frame it now has. Partial tails are retained. */
  push(text: string): SseFrame[];
  /** Returns a final frame if a complete-but-unterminated block remains; clears state. */
  flush(): SseFrame[];
}

const DEFAULT_EVENT_NAME = "message";

/** Strips at most one leading space from an SSE field value (the spec's "data: x" vs "data:x" rule). */
function stripOneLeadingSpace(value: string): string {
  return value.startsWith(" ") ? value.slice(1) : value;
}

/**
 * Parses one "block" (the text between two `\n\n` boundaries, already
 * normalized to `\n` line endings) into a frame, or `null` if the block
 * carries no usable `event`/`data` fields at all (e.g. an all-comment or
 * empty block produced by extra blank lines).
 */
function parseBlock(block: string): SseFrame | null {
  let event = DEFAULT_EVENT_NAME;
  let hasEventLine = false;
  const dataLines: string[] = [];

  for (const line of block.split("\n")) {
    if (line.length === 0) {
      // A blank line inside a block can't happen given how `push`/`flush`
      // slice on "\n\n", but guard defensively rather than mis-parsing.
      continue;
    }
    if (line.startsWith(":")) {
      // Comment line — SSE spec: ignored entirely.
      continue;
    }

    const colonIndex = line.indexOf(":");
    const field = colonIndex === -1 ? line : line.slice(0, colonIndex);
    const rawValue = colonIndex === -1 ? "" : line.slice(colonIndex + 1);
    const value = stripOneLeadingSpace(rawValue);

    if (field === "event") {
      event = value;
      hasEventLine = true;
    } else if (field === "data") {
      dataLines.push(value);
    }
    // `id:`/`retry:`/any other field name — ignored (not part of this contract).
  }

  if (!hasEventLine && dataLines.length === 0) {
    return null;
  }

  return { event, data: dataLines.join("\n") };
}

export function createSseFrameParser(): SseFrameParser {
  let buffer = "";

  function drain(): SseFrame[] {
    const frames: SseFrame[] = [];
    let boundary = buffer.indexOf("\n\n");

    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const frame = parseBlock(block);
      if (frame !== null) {
        frames.push(frame);
      }

      boundary = buffer.indexOf("\n\n");
    }

    return frames;
  }

  return {
    push(text: string): SseFrame[] {
      // Carry over any partial tail from a previous call — required so a
      // frame split across ANY number of chunks reassembles correctly.
      buffer += text.replace(/\r\n/g, "\n");
      return drain();
    },
    flush(): SseFrame[] {
      const remaining = buffer;
      buffer = "";

      if (remaining.trim().length === 0) {
        return [];
      }

      const frame = parseBlock(remaining);
      return frame === null ? [] : [frame];
    },
  };
}
