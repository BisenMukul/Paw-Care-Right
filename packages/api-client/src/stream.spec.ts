import { ApiError } from "./errors";
import { streamSseRequest, type SseFrame, type SseTransport, type SseTransportResponse } from "./stream";

const REQ = { url: "https://api.test/v1/chat/threads/t1/messages", method: "POST" as const, headers: {}, body: "{}" };

function asyncChunks(chunks: string[]): AsyncIterable<string> {
  return {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        next(): Promise<IteratorResult<string>> {
          if (index < chunks.length) {
            const value = chunks[index] as string;
            index += 1;
            return Promise.resolve({ value, done: false });
          }
          return Promise.resolve({ value: undefined, done: true });
        },
      };
    },
  };
}

/** An async iterable that yields some chunks then throws (simulates a mid-body transport failure). */
function asyncChunksThenThrow(chunks: string[], error: unknown): AsyncIterable<string> {
  return {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        next(): Promise<IteratorResult<string>> {
          if (index < chunks.length) {
            const value = chunks[index] as string;
            index += 1;
            return Promise.resolve({ value, done: false });
          }
          return Promise.reject(error);
        },
      };
    },
  };
}

function okResponse(chunks: string[], headers: Record<string, string> = {}): SseTransportResponse {
  return {
    status: 200,
    getHeader: (name) => headers[name.toLowerCase()] ?? null,
    chunks: asyncChunks(chunks),
  };
}

describe("streamSseRequest", () => {
  it("dispatches every frame of a recorded T081 sequence in order", async () => {
    const body =
      'event: start\ndata: {"threadId":"t1","userMessageId":"u1","assistantMessageId":"a1"}\n\n' +
      'event: nudge\ndata: {"category":"vomiting"}\n\n' +
      'event: chunk\ndata: {"seq":0,"text":"Hi "}\n\n' +
      'event: chunk\ndata: {"seq":1,"text":"there"}\n\n' +
      'event: chunk\ndata: {"seq":2,"text":"."}\n\n' +
      'event: done\ndata: {"assistantMessageId":"a1","status":"OK","quota":{"used":1,"limit":200,"remaining":199}}\n\n';

    const transport: SseTransport = jest.fn(async () => okResponse([body]));
    const frames: SseFrame[] = [];

    await streamSseRequest(transport, REQ, { onFrame: (frame) => frames.push(frame) });

    expect(frames.map((f) => f.event)).toEqual(["start", "nudge", "chunk", "chunk", "chunk", "done"]);
    expect(frames[2]?.data).toBe('{"seq":0,"text":"Hi "}');
  });

  it("200 happy path: onOpen is called once, before any frame, with 2xx headers", async () => {
    const transport: SseTransport = jest.fn(async () =>
      okResponse(['event: chunk\ndata: {"seq":0,"text":"x"}\n\n'], { "x-quota-remaining": "5" }),
    );
    const order: string[] = [];
    let seenQuotaHeader: string | null = null;
    const onOpen = jest.fn((headers: { get(name: string): string | null }) => {
      order.push("open");
      seenQuotaHeader = headers.get("X-Quota-Remaining");
    });
    const onFrame = jest.fn(() => order.push("frame"));

    await streamSseRequest(transport, REQ, { onOpen, onFrame });

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(seenQuotaHeader).toBe("5");
    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["open", "frame"]);
  });

  it("reassembles a frame split across transport chunks (split-frame reassembly)", async () => {
    const transport: SseTransport = jest.fn(async () =>
      okResponse(['event: chunk\ndata: {"se', 'q":0,"text":"Hello"}\n\n']),
    );
    const frames: SseFrame[] = [];

    await streamSseRequest(transport, REQ, { onFrame: (frame) => frames.push(frame) });

    expect(frames).toEqual([{ event: "chunk", data: '{"seq":0,"text":"Hello"}' }]);
  });

  it("normalizes a 402 envelope body into an ApiError with code PAYMENT_REQUIRED", async () => {
    const envelope = JSON.stringify({ error: { code: "PAYMENT_REQUIRED", message: "premium only", requestId: "r1" } });
    const transport: SseTransport = jest.fn(async () => ({
      status: 402,
      getHeader: () => null,
      chunks: asyncChunks([envelope]),
    }));

    await expect(streamSseRequest(transport, REQ, { onFrame: jest.fn() })).rejects.toMatchObject({
      code: "PAYMENT_REQUIRED",
      httpStatus: 402,
    });
  });

  it("normalizes a 404 envelope body into an ApiError with code NOT_FOUND", async () => {
    const envelope = JSON.stringify({ error: { code: "NOT_FOUND", message: "no thread", requestId: "r2" } });
    const transport: SseTransport = jest.fn(async () => ({
      status: 404,
      getHeader: () => null,
      chunks: asyncChunks([envelope]),
    }));

    await expect(streamSseRequest(transport, REQ, { onFrame: jest.fn() })).rejects.toMatchObject({
      code: "NOT_FOUND",
      httpStatus: 404,
    });
  });

  it("a network throw mid-body normalizes to an ApiError with httpStatus 0", async () => {
    const transport: SseTransport = jest.fn(async () => ({
      status: 200,
      getHeader: () => null,
      chunks: asyncChunksThenThrow(['event: chunk\ndata: {"seq":0,"text":"partial"}\n\n'], new Error("socket reset")),
    }));
    const frames: SseFrame[] = [];

    await expect(streamSseRequest(transport, REQ, { onFrame: (frame) => frames.push(frame) })).rejects.toMatchObject({
      code: "INTERNAL",
      httpStatus: 0,
    });
    expect(frames).toHaveLength(1);
  });

  it("a transport rejection surfaces as an ApiError with httpStatus 0", async () => {
    const transport: SseTransport = jest.fn(async () => {
      throw new TypeError("network down");
    });

    await expect(streamSseRequest(transport, REQ, { onFrame: jest.fn() })).rejects.toBeInstanceOf(ApiError);
    await expect(streamSseRequest(transport, REQ, { onFrame: jest.fn() })).rejects.toMatchObject({
      code: "INTERNAL",
      httpStatus: 0,
    });
  });

  it("abort: passing options.signal is forwarded to the transport request", async () => {
    const controller = new AbortController();
    const transport = jest.fn(async (req) => {
      expect(req.signal).toBe(controller.signal);
      return okResponse(["event: chunk\ndata: {\"seq\":0,\"text\":\"x\"}\n\n"]);
    }) as unknown as SseTransport;

    await streamSseRequest(transport, REQ, { onFrame: jest.fn(), signal: controller.signal });

    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("an onFrame throw (e.g. an aborted/invalid frame) stops consuming further chunks", async () => {
    const transport: SseTransport = jest.fn(async () =>
      okResponse([
        'event: chunk\ndata: {"seq":0,"text":"first"}\n\n',
        'event: chunk\ndata: {"seq":1,"text":"second"}\n\n',
      ]),
    );
    const seen: SseFrame[] = [];

    await expect(
      streamSseRequest(transport, REQ, {
        onFrame: (frame) => {
          seen.push(frame);
          throw new Error("boom");
        },
      }),
    ).rejects.toMatchObject({ code: "INTERNAL", httpStatus: 0 });

    expect(seen).toHaveLength(1);
  });

  it("an onFrame throw on a flushed (unterminated-tail) frame is normalized to an ApiError (FINDING-6)", async () => {
    // No trailing "\n\n" -- the main for-await loop's `parser.push` never
    // completes this frame; it is only ever emitted via `parser.flush()`.
    const transport: SseTransport = jest.fn(async () => okResponse(['event: chunk\ndata: {"seq":0,"text":"tail"}']));
    const seen: SseFrame[] = [];

    await expect(
      streamSseRequest(transport, REQ, {
        onFrame: (frame) => {
          seen.push(frame);
          throw new Error("boom-on-flush");
        },
      }),
    ).rejects.toMatchObject({ code: "INTERNAL", httpStatus: 0 });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual({ event: "chunk", data: '{"seq":0,"text":"tail"}' });
  });
});
