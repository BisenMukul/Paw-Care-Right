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
});
