import type { AdminAuthConfig } from "./admin-env";
import { authorizeAdminRequest, parseBasicAuthHeader } from "./admin-auth";

const CONFIG: AdminAuthConfig = { allowedEmails: ["owner@bombaypetcompany.local"], password: "correct-horse" };

function basicHeader(email: string, password: string): string {
  return `Basic ${Buffer.from(`${email}:${password}`, "utf-8").toString("base64")}`;
}

describe("parseBasicAuthHeader", () => {
  it("returns null for an absent header", () => {
    expect(parseBasicAuthHeader(null)).toBeNull();
    expect(parseBasicAuthHeader(undefined)).toBeNull();
  });

  it("returns null for a non-Basic scheme", () => {
    expect(parseBasicAuthHeader("Bearer sometoken")).toBeNull();
  });

  it("returns null for undecodable base64", () => {
    expect(parseBasicAuthHeader("Basic ###not-base64###")).toBeNull();
  });

  it("returns null when the decoded value has no colon separator", () => {
    const noColon = Buffer.from("no-colon-here", "utf-8").toString("base64");
    expect(parseBasicAuthHeader(`Basic ${noColon}`)).toBeNull();
  });

  it("splits on the FIRST colon only, so a password may itself contain a colon", () => {
    expect(parseBasicAuthHeader(basicHeader("owner@example.com", "pa:ss:word"))).toEqual({
      email: "owner@example.com",
      password: "pa:ss:word",
    });
  });

  it("round-trips a well-formed header", () => {
    expect(parseBasicAuthHeader(basicHeader("a@b.com", "secret"))).toEqual({ email: "a@b.com", password: "secret" });
  });
});

describe("authorizeAdminRequest", () => {
  it("allowlisted email + correct password -> ok", async () => {
    const header = basicHeader("owner@bombaypetcompany.local", "correct-horse");
    expect(await authorizeAdminRequest(header, CONFIG)).toBe("ok");
  });

  it("allowlisted email + wrong password -> unauthorized", async () => {
    const header = basicHeader("owner@bombaypetcompany.local", "wrong-password");
    expect(await authorizeAdminRequest(header, CONFIG)).toBe("unauthorized");
  });

  it("non-allowlisted email + correct password -> unauthorized (the allowlist is load-bearing, not decorative)", async () => {
    const header = basicHeader("stranger@example.com", "correct-horse");
    expect(await authorizeAdminRequest(header, CONFIG)).toBe("unauthorized");
  });

  it("a case/whitespace variant of an allowlisted email -> ok", async () => {
    const header = basicHeader("  Owner@BombayPetCompany.LOCAL  ", "correct-horse");
    expect(await authorizeAdminRequest(header, CONFIG)).toBe("ok");
  });

  it("absent header -> unauthorized", async () => {
    expect(await authorizeAdminRequest(undefined, CONFIG)).toBe("unauthorized");
  });

  it("malformed base64 -> unauthorized", async () => {
    expect(await authorizeAdminRequest("Basic ###not-base64###", CONFIG)).toBe("unauthorized");
  });

  it("config === null rejects even a well-formed, correct-looking header (fail-closed)", async () => {
    const header = basicHeader("owner@bombaypetcompany.local", "correct-horse");
    expect(await authorizeAdminRequest(header, null)).toBe("unauthorized");
  });

  it("a colon-containing password round-trips through authorization", async () => {
    const config: AdminAuthConfig = { allowedEmails: ["owner@bombaypetcompany.local"], password: "pa:ss:word" };
    const header = basicHeader("owner@bombaypetcompany.local", "pa:ss:word");
    expect(await authorizeAdminRequest(header, config)).toBe("ok");
  });
});
