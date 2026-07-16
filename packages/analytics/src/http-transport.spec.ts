import { createHttpTransport } from "./http-transport";

function fakeFetch(impl: (url: string, init?: RequestInit) => Promise<Response>): typeof fetch {
  return impl as unknown as typeof fetch;
}

function okResponse(): Response {
  return { ok: true } as Response;
}

describe("createHttpTransport", () => {
  it("with a key, POSTs {host}/capture/ with api_key/event/distinct_id/properties", () => {
    const fetchImpl = jest.fn().mockResolvedValue(okResponse());
    const transport = createHttpTransport({
      apiKey: "phc_test_key",
      host: "https://us.i.posthog.com",
      fetchImpl: fakeFetch(fetchImpl),
    });

    transport.send({ distinctId: "user-1", event: "paywall_view", properties: { source: "onboarding" } });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://us.i.posthog.com/capture/");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "content-type": "application/json" });

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toEqual(
      expect.objectContaining({
        api_key: "phc_test_key",
        event: "paywall_view",
        distinct_id: "user-1",
        properties: { source: "onboarding" },
        timestamp: expect.any(String),
      }),
    );
  });

  it("an empty apiKey is a no-op: fetchImpl is never called", () => {
    const fetchImpl = jest.fn();
    const transport = createHttpTransport({ apiKey: "", host: "https://us.i.posthog.com", fetchImpl: fakeFetch(fetchImpl) });

    transport.send({ distinctId: "user-1", event: "paywall_view", properties: { source: "onboarding" } });

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("a rejected fetch is swallowed (no throw) and reported via onError", async () => {
    const rejection = new Error("network down");
    const fetchImpl = jest.fn().mockRejectedValue(rejection);
    const onError = jest.fn();
    const transport = createHttpTransport({
      apiKey: "phc_test_key",
      host: "https://us.i.posthog.com",
      fetchImpl: fakeFetch(fetchImpl),
      onError,
    });

    expect(() =>
      transport.send({ distinctId: "user-1", event: "paywall_view", properties: { source: "onboarding" } }),
    ).not.toThrow();

    // Flush the microtask queue so the rejection handler runs.
    await Promise.resolve();
    await Promise.resolve();

    expect(onError).toHaveBeenCalledWith(rejection);
  });

  it("a rejected fetch with no onError provided never throws (default swallow)", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("network down"));
    const transport = createHttpTransport({
      apiKey: "phc_test_key",
      host: "https://us.i.posthog.com",
      fetchImpl: fakeFetch(fetchImpl),
    });

    expect(() =>
      transport.send({ distinctId: "user-1", event: "paywall_view", properties: { source: "onboarding" } }),
    ).not.toThrow();

    await Promise.resolve();
    await Promise.resolve();
  });
});
