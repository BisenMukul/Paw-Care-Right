import type { SseFrame } from "@pawcareright/api-client";

import { parseChatFrame } from "./chat-events";

function frame(event: string, data: unknown): SseFrame {
  return { event, data: JSON.stringify(data) };
}

describe("parseChatFrame", () => {
  it("parses a valid start frame", () => {
    const event = parseChatFrame(
      frame("start", { threadId: "t1", userMessageId: "u1", assistantMessageId: "a1" }),
    );

    expect(event).toEqual({
      kind: "start",
      value: { threadId: "t1", userMessageId: "u1", assistantMessageId: "a1" },
    });
  });

  it("parses a valid nudge frame", () => {
    const event = parseChatFrame(frame("nudge", { category: "vomiting" }));

    expect(event).toEqual({ kind: "nudge", value: { category: "vomiting" } });
  });

  it("parses a valid chunk frame", () => {
    const event = parseChatFrame(frame("chunk", { seq: 0, text: "Hi " }));

    expect(event).toEqual({ kind: "chunk", value: { seq: 0, text: "Hi " } });
  });

  it("parses a valid done frame (status OK)", () => {
    const event = parseChatFrame(
      frame("done", { assistantMessageId: "a1", status: "OK", quota: { used: 1, limit: 200, remaining: 199 } }),
    );

    expect(event).toEqual({
      kind: "done",
      value: { assistantMessageId: "a1", status: "OK", quota: { used: 1, limit: 200, remaining: 199 } },
    });
  });

  it("parses a valid done frame (status SAFE_FALLBACK)", () => {
    const event = parseChatFrame(
      frame("done", {
        assistantMessageId: "a1",
        status: "SAFE_FALLBACK",
        quota: { used: 1, limit: 200, remaining: 199 },
      }),
    );

    expect(event.kind).toBe("done");
    expect(event.kind === "done" && event.value.status).toBe("SAFE_FALLBACK");
  });

  it("returns 'unknown' for an unrecognized event name (forward-compatible, ignored)", () => {
    const event = parseChatFrame({ event: "ping", data: "{}" });

    expect(event).toEqual({ kind: "unknown" });
  });

  it("returns 'invalid' for a KNOWN event name whose payload fails schema validation", () => {
    const event = parseChatFrame(frame("chunk", { seq: "not-a-number", text: "x" }));

    expect(event).toEqual({ kind: "invalid", event: "chunk" });
  });

  it("returns 'invalid' for a KNOWN event name whose payload is malformed JSON (fails upward, never guessed)", () => {
    const event = parseChatFrame({ event: "chunk", data: "{not json" });

    expect(event).toEqual({ kind: "invalid", event: "chunk" });
  });

  it("returns 'invalid' for a nudge frame with an unknown symptom category", () => {
    const event = parseChatFrame(frame("nudge", { category: "not-a-real-category" }));

    expect(event).toEqual({ kind: "invalid", event: "nudge" });
  });

  it("returns 'invalid' for a done frame with an unrecognized status", () => {
    const event = parseChatFrame(
      frame("done", { assistantMessageId: "a1", status: "MADE_UP", quota: { used: 1, limit: 200, remaining: 199 } }),
    );

    expect(event).toEqual({ kind: "invalid", event: "done" });
  });
});
