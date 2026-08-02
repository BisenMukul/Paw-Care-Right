import { parseAdminApiConfig, parseAdminAuthConfig } from "./admin-env";

describe("parseAdminAuthConfig", () => {
  it("returns null when ADMIN_DASHBOARD_PASSWORD is absent", () => {
    expect(parseAdminAuthConfig({ ADMIN_ALLOWED_EMAILS: "a@b.com" })).toBeNull();
  });

  it("returns null when ADMIN_DASHBOARD_PASSWORD is empty", () => {
    expect(
      parseAdminAuthConfig({ ADMIN_DASHBOARD_PASSWORD: "", ADMIN_ALLOWED_EMAILS: "a@b.com" }),
    ).toBeNull();
  });

  it("returns null when ADMIN_DASHBOARD_PASSWORD is whitespace-only", () => {
    expect(
      parseAdminAuthConfig({ ADMIN_DASHBOARD_PASSWORD: "   ", ADMIN_ALLOWED_EMAILS: "a@b.com" }),
    ).toBeNull();
  });

  it("returns null when ADMIN_ALLOWED_EMAILS is absent", () => {
    expect(parseAdminAuthConfig({ ADMIN_DASHBOARD_PASSWORD: "secret" })).toBeNull();
  });

  it("returns null when ADMIN_ALLOWED_EMAILS parses to zero entries (empty string)", () => {
    expect(
      parseAdminAuthConfig({ ADMIN_DASHBOARD_PASSWORD: "secret", ADMIN_ALLOWED_EMAILS: "" }),
    ).toBeNull();
  });

  it("returns null when ADMIN_ALLOWED_EMAILS is a lone comma (both sides trim to empty)", () => {
    expect(
      parseAdminAuthConfig({ ADMIN_DASHBOARD_PASSWORD: "secret", ADMIN_ALLOWED_EMAILS: "," }),
    ).toBeNull();
  });

  it("parses a comma-separated, whitespace-padded, mixed-case list into trimmed lowercase emails", () => {
    const result = parseAdminAuthConfig({
      ADMIN_DASHBOARD_PASSWORD: "secret",
      ADMIN_ALLOWED_EMAILS: " A@b.com , c@d.com ",
    });
    expect(result).toEqual({ allowedEmails: ["a@b.com", "c@d.com"], password: "secret" });
  });

  it("empty password AND empty allowlist both parse to null (closed) -- fail-closed non-vacuity", () => {
    expect(parseAdminAuthConfig({ ADMIN_DASHBOARD_PASSWORD: "", ADMIN_ALLOWED_EMAILS: "" })).toBeNull();
  });
});

describe("parseAdminApiConfig", () => {
  it("returns null when ADMIN_API_TOKEN is absent", () => {
    expect(parseAdminApiConfig({})).toBeNull();
  });

  it("returns null when ADMIN_API_TOKEN is empty", () => {
    expect(parseAdminApiConfig({ ADMIN_API_TOKEN: "" })).toBeNull();
  });

  it("defaults ADMIN_API_BASE_URL to http://localhost:3000 when absent", () => {
    expect(parseAdminApiConfig({ ADMIN_API_TOKEN: "tok" })).toEqual({
      baseUrl: "http://localhost:3000",
      adminToken: "tok",
    });
  });

  it("uses an explicit ADMIN_API_BASE_URL when set", () => {
    expect(
      parseAdminApiConfig({ ADMIN_API_TOKEN: "tok", ADMIN_API_BASE_URL: "https://api.internal.example" }),
    ).toEqual({ baseUrl: "https://api.internal.example", adminToken: "tok" });
  });
});
