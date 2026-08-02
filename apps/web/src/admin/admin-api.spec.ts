import { fetchAdminAudit, fetchAdminKpis, fetchAdminUser } from "./admin-api";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

function setConfiguredEnv() {
  process.env.ADMIN_API_TOKEN = "super-secret-admin-token";
  process.env.ADMIN_API_BASE_URL = "https://api.internal.example";
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as unknown as Response;
}

describe("admin-api fetchers", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    global.fetch = ORIGINAL_FETCH;
  });

  it("returns 'unconfigured' when ADMIN_API_TOKEN is unset (never calls fetch)", async () => {
    delete process.env.ADMIN_API_TOKEN;
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchAdminKpis();

    expect(result).toEqual({ kind: "unconfigured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("issues a GET request carrying the x-admin-token header", async () => {
    setConfiguredEnv();
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse(200, { days: 30, generatedAt: "2026-07-30T00:00:00.000Z", daily: [], tiers: { totalUsers: 0, premiumSubscriptions: 0, expiredOrInactiveSubscriptions: 0, activeReferralGrants: 0 } }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await fetchAdminKpis(30);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.internal.example/v1/admin/kpis?days=30");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>)["x-admin-token"]).toBe("super-secret-admin-token");
    expect(init.cache).toBe("no-store");
  });

  it("the admin token never appears anywhere in the returned value", async () => {
    setConfiguredEnv();
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse(200, { days: 30, generatedAt: "2026-07-30T00:00:00.000Z", daily: [], tiers: { totalUsers: 0, premiumSubscriptions: 0, expiredOrInactiveSubscriptions: 0, activeReferralGrants: 0 } }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchAdminKpis(30);

    expect(JSON.stringify(result)).not.toContain("super-secret-admin-token");
  });

  it("a 500 response resolves to a typed error, never a thrown stack", async () => {
    setConfiguredEnv();
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(500, { error: { code: "INTERNAL" } }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchAdminKpis(30);

    expect(result).toEqual({ kind: "error", code: "500" });
  });

  it("a 404 on the user lookup resolves to 'not-found'", async () => {
    setConfiguredEnv();
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(404, { error: { code: "NOT_FOUND" } }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchAdminUser("nobody@example.com");

    expect(result).toEqual({ kind: "not-found" });
  });

  it("a schema-invalid body resolves to a typed error, never a partial render", async () => {
    setConfiguredEnv();
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, { totally: "not-the-right-shape" }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchAdminAudit({ limit: 10 });

    expect(result).toEqual({ kind: "error", code: "INVALID_SCHEMA" });
  });

  it("a network failure resolves to a typed error, never a thrown stack", async () => {
    setConfiguredEnv();
    const fetchMock = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchAdminUser("nobody@example.com");

    expect(result).toEqual({ kind: "error", code: "NETWORK_ERROR" });
  });

  it("fetchAdminAudit encodes limit/cursor as query params", async () => {
    setConfiguredEnv();
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, { rows: [], nextCursor: null }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await fetchAdminAudit({ limit: 5, cursor: "abc-123" });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://api.internal.example/v1/admin/ai-audit?limit=5&cursor=abc-123");
  });
});
