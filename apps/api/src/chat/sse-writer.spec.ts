import type { Response } from "express";

import { SseWriter } from "./sse-writer";

function fakeResponse(): {
  res: Response;
  writeHead: jest.Mock;
  write: jest.Mock;
  end: jest.Mock;
  on: jest.Mock;
} {
  const writeHead = jest.fn();
  const write = jest.fn();
  const end = jest.fn();
  const on = jest.fn();
  const res = { writeHead, write, end, on } as unknown as Response;
  return { res, writeHead, write, end, on };
}

describe("SseWriter", () => {
  it("frames are exactly `event: <e>\\ndata: <json>\\n\\n`", () => {
    const { res, write } = fakeResponse();
    const writer = new SseWriter(res);
    writer.writeHead();

    writer.send("chunk", { seq: 0, text: "hi" });

    expect(write).toHaveBeenCalledWith('event: chunk\ndata: {"seq":0,"text":"hi"}\n\n');
  });

  it("writes headers exactly once even if writeHead is called twice", () => {
    const { res, writeHead } = fakeResponse();
    const writer = new SseWriter(res);

    writer.writeHead({ "X-Quota-Limit": "200" });
    writer.writeHead({ "X-Quota-Limit": "999" });

    expect(writeHead).toHaveBeenCalledTimes(1);
    expect(writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Quota-Limit": "200",
      }),
    );
  });

  it("end() is idempotent", () => {
    const { res, end } = fakeResponse();
    const writer = new SseWriter(res);
    writer.writeHead();

    writer.end();
    writer.end();

    expect(end).toHaveBeenCalledTimes(1);
  });

  it("send() no-ops after end()", () => {
    const { res, write } = fakeResponse();
    const writer = new SseWriter(res);
    writer.writeHead();
    writer.end();

    writer.send("chunk", { seq: 0, text: "too late" });

    expect(write).not.toHaveBeenCalled();
  });

  it("headersSent reflects whether writeHead has been called", () => {
    const { res } = fakeResponse();
    const writer = new SseWriter(res);
    expect(writer.headersSent).toBe(false);

    writer.writeHead();
    expect(writer.headersSent).toBe(true);
  });

  it("onClose registers a 'close' listener on the underlying response", () => {
    const { res, on } = fakeResponse();
    const writer = new SseWriter(res);
    const callback = jest.fn();

    writer.onClose(callback);

    expect(on).toHaveBeenCalledWith("close", callback);
  });
});
