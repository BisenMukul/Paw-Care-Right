import { createApiClient } from "./client";
import { ApiError } from "./errors";
import type { SseTransport, SseTransportRequest, SseTransportResponse } from "./stream";

function fakeFetch(impl: (url: string, init?: RequestInit) => Promise<Response>): typeof fetch {
  return jest.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    impl(String(input), init),
  ) as unknown as typeof fetch;
}

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

function okStreamResponse(chunks: string[]): SseTransportResponse {
  return { status: 200, getHeader: () => null, chunks: asyncChunks(chunks) };
}

describe("createApiClient", () => {
  it("returns parsed JSON typed as T on a 2xx response", async () => {
    const fetchMock = fakeFetch(async () => new Response(JSON.stringify({ id: "1" }), { status: 200 }));
    const client = createApiClient({ baseUrl: "https://api.test", fetch: fetchMock });

    const result = await client.get<{ id: string }>("/pets/1");

    expect(result).toEqual({ id: "1" });
    expect(fetchMock).toHaveBeenCalledWith("https://api.test/pets/1", expect.any(Object));
  });

  it("adds an Authorization header when getAuthToken resolves a token", async () => {
    const fetchMock = fakeFetch(async (_url, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer test-token");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    const client = createApiClient({
      baseUrl: "https://api.test",
      getAuthToken: () => "test-token",
      fetch: fetchMock,
    });

    await client.get("/me");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("omits the Authorization header when getAuthToken resolves null", async () => {
    const fetchMock = fakeFetch(async (_url, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.has("Authorization")).toBe(false);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    const client = createApiClient({
      baseUrl: "https://api.test",
      getAuthToken: () => null,
      fetch: fetchMock,
    });

    await client.get("/me");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects with a typed UNAUTHORIZED ApiError on a 401 response", async () => {
    const fetchMock = fakeFetch(
      async () =>
        new Response(
          JSON.stringify({ error: { code: "UNAUTHORIZED", message: "no token", requestId: "req-9" } }),
          { status: 401 },
        ),
    );
    const client = createApiClient({ baseUrl: "https://api.test", fetch: fetchMock });

    await expect(client.get("/me")).rejects.toBeInstanceOf(ApiError);
    await expect(client.get("/me")).rejects.toMatchObject({ code: "UNAUTHORIZED", httpStatus: 401 });
  });

  it("normalizes a fetch throw into a network ApiError", async () => {
    const fetchMock = jest.fn(async () => {
      throw new TypeError("network down");
    }) as unknown as typeof fetch;
    const client = createApiClient({ baseUrl: "https://api.test", fetch: fetchMock });

    await expect(client.get("/me")).rejects.toMatchObject({ code: "INTERNAL", httpStatus: 0 });
  });

  it("sends a JSON body with a Content-Type header for post()", async () => {
    const fetchMock = fakeFetch(async (_url, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("Content-Type")).toBe("application/json");
      expect(init?.body).toBe(JSON.stringify({ name: "Rex" }));
      expect(init?.method).toBe("POST");
      return new Response(JSON.stringify({ id: "2" }), { status: 201 });
    });
    const client = createApiClient({ baseUrl: "https://api.test", fetch: fetchMock });

    const result = await client.post<{ id: string }>("/pets", { name: "Rex" });

    expect(result).toEqual({ id: "2" });
  });

  describe("401 -> refresh -> retry", () => {
    function unauthorizedResponse(): Response {
      return new Response(
        JSON.stringify({ error: { code: "UNAUTHORIZED", message: "expired", requestId: "req-1" } }),
        { status: 401 },
      );
    }

    it("retries once after a 401 with the refreshed token", async () => {
      let callCount = 0;
      const fetchMock = fakeFetch(async (_url, init) => {
        callCount += 1;
        const headers = new Headers(init?.headers);
        if (callCount === 1) {
          expect(headers.get("Authorization")).toBeNull();
          return unauthorizedResponse();
        }
        expect(headers.get("Authorization")).toBe("Bearer new-token");
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      });
      const refreshSession = jest.fn(async () => "new-token");
      const onSessionExpired = jest.fn();
      const client = createApiClient({
        baseUrl: "https://api.test",
        fetch: fetchMock,
        refreshSession,
        onSessionExpired,
      });

      const result = await client.get<{ ok: true }>("/me");

      expect(result).toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(refreshSession).toHaveBeenCalledTimes(1);
      expect(onSessionExpired).not.toHaveBeenCalled();
    });

    it("dedupes concurrent 401s into one refresh", async () => {
      const fetchMock = fakeFetch(async (_url, init) => {
        const headers = new Headers(init?.headers);
        if (headers.get("Authorization") === "Bearer new-token") {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        return unauthorizedResponse();
      });
      const refreshSession = jest.fn(async () => "new-token");
      const onSessionExpired = jest.fn();
      const client = createApiClient({
        baseUrl: "https://api.test",
        fetch: fetchMock,
        refreshSession,
        onSessionExpired,
      });

      const [resultA, resultB] = await Promise.all([
        client.get<{ ok: true }>("/a"),
        client.get<{ ok: true }>("/b"),
      ]);

      expect(resultA).toEqual({ ok: true });
      expect(resultB).toEqual({ ok: true });
      expect(refreshSession).toHaveBeenCalledTimes(1);
      expect(onSessionExpired).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it("calls onSessionExpired and throws when refresh returns null", async () => {
      const fetchMock = fakeFetch(async () => unauthorizedResponse());
      const refreshSession = jest.fn(async () => null);
      const onSessionExpired = jest.fn();
      const client = createApiClient({
        baseUrl: "https://api.test",
        fetch: fetchMock,
        refreshSession,
        onSessionExpired,
      });

      await expect(client.get("/me")).rejects.toMatchObject({ code: "UNAUTHORIZED", httpStatus: 401 });

      expect(refreshSession).toHaveBeenCalledTimes(1);
      expect(onSessionExpired).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("calls onSessionExpired and throws when refresh throws", async () => {
      const fetchMock = fakeFetch(async () => unauthorizedResponse());
      const refreshSession = jest.fn(async () => {
        throw new Error("refresh boom");
      });
      const onSessionExpired = jest.fn();
      const client = createApiClient({
        baseUrl: "https://api.test",
        fetch: fetchMock,
        refreshSession,
        onSessionExpired,
      });

      await expect(client.get("/me")).rejects.toMatchObject({ code: "UNAUTHORIZED", httpStatus: 401 });

      expect(refreshSession).toHaveBeenCalledTimes(1);
      expect(onSessionExpired).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("calls onSessionExpired on a second 401 after retry (no loop)", async () => {
      const fetchMock = fakeFetch(async () => unauthorizedResponse());
      const refreshSession = jest.fn(async () => "new-token");
      const onSessionExpired = jest.fn();
      const client = createApiClient({
        baseUrl: "https://api.test",
        fetch: fetchMock,
        refreshSession,
        onSessionExpired,
      });

      await expect(client.get("/me")).rejects.toMatchObject({ code: "UNAUTHORIZED", httpStatus: 401 });

      expect(refreshSession).toHaveBeenCalledTimes(1);
      expect(onSessionExpired).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});

// T083 plan step 4 — additive `describe`, appended only. Every case above
// this point is unmodified (plan D3/R3: `apps/web` must keep passing every
// existing case unmodified since it never configures `streamTransport`).
describe("streamSse", () => {
  it("throws when no streamTransport is configured", async () => {
    const client = createApiClient({ baseUrl: "https://api.test" });

    await expect(client.streamSse("/v1/chat/threads/t1/messages", { content: "hi" }, { onFrame: jest.fn() })).rejects.toThrow();
  });

  it("sends the auth header and the JSON body", async () => {
    const transport: SseTransport = jest.fn(async (req: SseTransportRequest) => {
      expect(req.method).toBe("POST");
      expect(req.headers.Authorization).toBe("Bearer test-token");
      expect(req.headers["Content-Type"]).toBe("application/json");
      expect(JSON.parse(req.body)).toEqual({ content: "hi" });
      return okStreamResponse(['event: chunk\ndata: {"seq":0,"text":"x"}\n\n']);
    });
    const client = createApiClient({
      baseUrl: "https://api.test",
      getAuthToken: () => "test-token",
      streamTransport: transport,
    });

    await client.streamSse("/v1/chat/threads/t1/messages", { content: "hi" }, { onFrame: jest.fn() });

    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("a 402 body is normalized to an ApiError with code PAYMENT_REQUIRED", async () => {
    const transport: SseTransport = jest.fn(async () => ({
      status: 402,
      getHeader: () => null,
      chunks: asyncChunks([JSON.stringify({ error: { code: "PAYMENT_REQUIRED", message: "premium only", requestId: "r1" } })]),
    }));
    const client = createApiClient({ baseUrl: "https://api.test", streamTransport: transport });

    await expect(
      client.streamSse("/v1/chat/threads/t1/messages", { content: "hi" }, { onFrame: jest.fn() }),
    ).rejects.toMatchObject({ code: "PAYMENT_REQUIRED", httpStatus: 402 });
  });

  it("a 401 triggers exactly one single-flighted refresh then one retry", async () => {
    let callCount = 0;
    const transport: SseTransport = jest.fn(async (req: SseTransportRequest) => {
      callCount += 1;
      if (callCount === 1) {
        return {
          status: 401,
          getHeader: () => null,
          chunks: asyncChunks([JSON.stringify({ error: { code: "UNAUTHORIZED", message: "expired", requestId: "r1" } })]),
        };
      }
      expect(req.headers.Authorization).toBe("Bearer fresh-token");
      return okStreamResponse(['event: chunk\ndata: {"seq":0,"text":"x"}\n\n']);
    });
    const refreshSession = jest.fn(async () => "fresh-token");
    const client = createApiClient({
      baseUrl: "https://api.test",
      getAuthToken: () => "stale-token",
      refreshSession,
      streamTransport: transport,
    });

    await client.streamSse("/v1/chat/threads/t1/messages", { content: "hi" }, { onFrame: jest.fn() });

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("calls onSessionExpired and rethrows when refresh yields null", async () => {
    const transport: SseTransport = jest.fn(async () => ({
      status: 401,
      getHeader: () => null,
      chunks: asyncChunks([JSON.stringify({ error: { code: "UNAUTHORIZED", message: "expired", requestId: "r1" } })]),
    }));
    const onSessionExpired = jest.fn();
    const client = createApiClient({
      baseUrl: "https://api.test",
      refreshSession: async () => null,
      onSessionExpired,
      streamTransport: transport,
    });

    await expect(
      client.streamSse("/v1/chat/threads/t1/messages", { content: "hi" }, { onFrame: jest.fn() }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED", httpStatus: 401 });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
