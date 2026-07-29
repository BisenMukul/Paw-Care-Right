import type { SseFrame } from "@bombaypetcompany/api-client";
import {
  chatChunkEventSchema,
  chatDoneEventSchema,
  chatNudgeEventSchema,
  chatStartEventSchema,
  type ChatChunkEvent,
  type ChatDoneEvent,
  type ChatNudgeEvent,
  type ChatStartEvent,
} from "@bombaypetcompany/types";

/**
 * Maps a raw `SseFrame` to a typed chat event (T083 plan decision D4). Every
 * KNOWN event name is validated against its `packages/types` Zod schema —
 * never a hand-written duplicate interface (CLAUDE §6). An unrecognized
 * event name is forward-compatible (`"unknown"`, ignored by the reducer); a
 * KNOWN name whose payload fails its schema is `"invalid"` — fail upward,
 * never guessed (CLAUDE §7 rule 5 / plan Safety statement 4). Pure: no I/O,
 * never throws.
 */
export type ChatEvent =
  | { kind: "start"; value: ChatStartEvent }
  | { kind: "nudge"; value: ChatNudgeEvent }
  | { kind: "chunk"; value: ChatChunkEvent }
  | { kind: "done"; value: ChatDoneEvent }
  | { kind: "unknown" }
  | { kind: "invalid"; event: string };

/** Best-effort JSON parse; `undefined` (never throws) on malformed JSON so schema validation fails cleanly. */
function parseJson(data: string): unknown {
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return undefined;
  }
}

export function parseChatFrame(frame: SseFrame): ChatEvent {
  const payload = parseJson(frame.data);

  switch (frame.event) {
    case "start": {
      const parsed = chatStartEventSchema.safeParse(payload);
      return parsed.success ? { kind: "start", value: parsed.data } : { kind: "invalid", event: frame.event };
    }
    case "nudge": {
      const parsed = chatNudgeEventSchema.safeParse(payload);
      return parsed.success ? { kind: "nudge", value: parsed.data } : { kind: "invalid", event: frame.event };
    }
    case "chunk": {
      const parsed = chatChunkEventSchema.safeParse(payload);
      return parsed.success ? { kind: "chunk", value: parsed.data } : { kind: "invalid", event: frame.event };
    }
    case "done": {
      const parsed = chatDoneEventSchema.safeParse(payload);
      return parsed.success ? { kind: "done", value: parsed.data } : { kind: "invalid", event: frame.event };
    }
    default:
      return { kind: "unknown" };
  }
}
