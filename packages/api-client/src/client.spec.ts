import { createApiClient } from "./client";
import { ApiError } from "./errors";

function fakeFetch(impl: (url: string, init?: RequestInit) => Promise<Response>): typeof fetch {
  return jest.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    impl(String(input), init),
  ) as unknown as typeof fetch;
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
