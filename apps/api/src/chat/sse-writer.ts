import type { Response } from "express";

/**
 * Tiny SSE frame writer over Express's raw `Response` (T081 plan decision
 * D2 — `@Res()` + a small tested helper, not Nest's `@Sse()`, which is a
 * GET-only decorator). No business logic: the controller/service decide
 * WHAT to send; this class only formats HOW frames are written and
 * guarantees headers are written at most once and `end()` is idempotent so
 * a caller can never double-write after the socket is done.
 */
export class SseWriter {
  private started = false;
  private ended = false;

  constructor(private readonly res: Response) {}

  /** Writes the fixed SSE response headers plus any caller-supplied extra headers (e.g. quota headers). Idempotent. */
  writeHead(extraHeaders: Record<string, string> = {}): void {
    if (this.started) {
      return;
    }
    this.started = true;

    this.res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...extraHeaders,
    });
  }

  /** Writes one `event: <event>\ndata: <json>\n\n` frame. No-ops once `end()` has been called. */
  send(event: string, data: unknown): void {
    if (this.ended) {
      return;
    }
    this.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  /** Ends the underlying response. Idempotent — a second call is a no-op. */
  end(): void {
    if (this.ended) {
      return;
    }
    this.ended = true;
    this.res.end();
  }

  /** Whether `writeHead` has already been called (so no JSON error envelope can follow). */
  get headersSent(): boolean {
    return this.started;
  }

  /** Registers a callback invoked when the underlying connection closes (client disconnect). */
  onClose(callback: () => void): void {
    this.res.on("close", callback);
  }
}
