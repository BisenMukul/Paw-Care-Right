import { createSseFrameParser } from "./sse";

describe("createSseFrameParser", () => {
  it("reassembles a frame split across N chunks", () => {
    const parser = createSseFrameParser();

    expect(parser.push("event: chu")).toEqual([]);
    expect(parser.push("nk\nda")).toEqual([]);
    expect(parser.push('ta: {"seq":0,"te')).toEqual([]);
    expect(parser.push('xt":"Hello"}')).toEqual([]);
    expect(parser.push("\n\n")).toEqual([{ event: "chunk", data: '{"seq":0,"text":"Hello"}' }]);
  });

  it("returns multiple frames present in one chunk, in order", () => {
    const parser = createSseFrameParser();

    const frames = parser.push(
      'event: start\ndata: {"a":1}\n\nevent: chunk\ndata: {"b":2}\n\nevent: done\ndata: {"c":3}\n\n',
    );

    expect(frames).toEqual([
      { event: "start", data: '{"a":1}' },
      { event: "chunk", data: '{"b":2}' },
      { event: "done", data: '{"c":3}' },
    ]);
  });

  it("handles CRLF line endings", () => {
    const parser = createSseFrameParser();

    const frames = parser.push('event: chunk\r\ndata: {"seq":0,"text":"Hi"}\r\n\r\n');

    expect(frames).toEqual([{ event: "chunk", data: '{"seq":0,"text":"Hi"}' }]);
  });

  it("strips exactly one leading space after `data:`", () => {
    const parser = createSseFrameParser();

    const withSpace = parser.push("event: chunk\ndata: x\n\n");
    expect(withSpace).toEqual([{ event: "chunk", data: "x" }]);

    const withoutSpace = parser.push("event: chunk\ndata:x\n\n");
    expect(withoutSpace).toEqual([{ event: "chunk", data: "x" }]);

    // Only ONE leading space is stripped -- a second space is data.
    const twoSpaces = parser.push("event: chunk\ndata:  x\n\n");
    expect(twoSpaces).toEqual([{ event: "chunk", data: " x" }]);
  });

  it("ignores comment and unknown-field lines", () => {
    const parser = createSseFrameParser();

    const frames = parser.push(":keep-alive\nid: 42\nretry: 3000\nevent: chunk\ndata: x\n\n");

    expect(frames).toEqual([{ event: "chunk", data: "x" }]);
  });

  it("defaults the event name to \"message\" when no event line is present", () => {
    const parser = createSseFrameParser();

    const frames = parser.push("data: x\n\n");

    expect(frames).toEqual([{ event: "message", data: "x" }]);
  });

  it("joins multiple data lines with \\n, in order", () => {
    const parser = createSseFrameParser();

    const frames = parser.push("event: chunk\ndata: line1\ndata: line2\n\n");

    expect(frames).toEqual([{ event: "chunk", data: "line1\nline2" }]);
  });

  it("retains an unterminated tail until flush()", () => {
    const parser = createSseFrameParser();

    expect(parser.push("event: chunk\ndata: partial")).toEqual([]);
    expect(parser.flush()).toEqual([{ event: "chunk", data: "partial" }]);
    // flush() clears state -- a second flush() with nothing buffered yields nothing.
    expect(parser.flush()).toEqual([]);
  });

  it("flush() returns nothing when the buffer is empty or whitespace-only", () => {
    const parser = createSseFrameParser();

    expect(parser.flush()).toEqual([]);

    parser.push("event: chunk\ndata: x\n\n   ");
    expect(parser.flush()).toEqual([]);
  });
});
