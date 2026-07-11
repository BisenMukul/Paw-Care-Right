import { fetchJson } from "./http";
import { ProviderError } from "./providers/types";

describe("fetchJson", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("returns the parsed JSON body on a 2xx response", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const result = await fetchJson<{ ok: boolean }>("test", "https://example.test/x", {});

    expect(result).toEqual({ ok: true });
  });

  it("maps a non-2xx response to ProviderError('http_error') with status", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "nope" }), { status: 503 }),
    );

    await expect(
      fetchJson("test", "https://example.test/x", {}),
    ).rejects.toMatchObject({
      code: "http_error",
      status: 503,
      provider: "test",
    });
  });

  it("maps a non-JSON body to ProviderError('invalid_response')", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response("not json", { status: 200 }),
    );

    await expect(
      fetchJson("test", "https://example.test/x", {}),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("maps an abort/timeout to ProviderError('timeout')", async () => {
    jest.useFakeTimers();
    jest.spyOn(global, "fetch").mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          const signal = (init as RequestInit).signal;
          signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        }),
    );

    const promise = fetchJson("test", "https://example.test/x", {}, 10);
    const assertion = expect(promise).rejects.toMatchObject({ code: "timeout" });

    await jest.advanceTimersByTimeAsync(10);
    await assertion;
  });

  it("throws a ProviderError instance", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 500 }));

    await expect(fetchJson("test", "https://example.test/x", {})).rejects.toBeInstanceOf(
      ProviderError,
    );
  });
});
