import fs from "node:fs";
import path from "node:path";

/**
 * T111 step 18: static pin over `apps/web/middleware.ts` (jest `roots` is
 * `src` only, so this file cannot literally live outside `src/` and still
 * run under jest -- a static source read mirrors the `e2e-gate.spec.ts`
 * idiom for asserting on a file jest cannot import/execute directly, since
 * Next middleware needs the Edge/Next runtime this repo's jest config does
 * not provide). `e2e/smoke.spec.ts` proves the real, running-server
 * behaviour this file only pins the wiring for.
 */
const MIDDLEWARE_PATH = path.join(__dirname, "..", "..", "middleware.ts");
const source = fs.readFileSync(MIDDLEWARE_PATH, "utf-8");

describe("apps/web/middleware.ts (static wiring pin)", () => {
  it("the matcher covers /admin and /admin/:path*", () => {
    expect(source).toMatch(/matcher:\s*\[\s*["']\/admin["']\s*,\s*["']\/admin\/:path\*["']\s*\]/);
  });

  it("imports authorizeAdminRequest and parseAdminAuthConfig from the pure src/admin modules", () => {
    expect(source).toMatch(/import\s*\{\s*authorizeAdminRequest\s*\}\s*from\s*["']\.\/src\/admin\/admin-auth["']/);
    expect(source).toMatch(/import\s*\{\s*parseAdminAuthConfig\s*\}\s*from\s*["']\.\/src\/admin\/admin-env["']/);
  });

  it("emits a 401 with a WWW-Authenticate header on any non-ok result", () => {
    expect(source).toContain("status: 401");
    expect(source).toContain("WWW-Authenticate");
  });

  it("contains no NEXT_PUBLIC_ name, no console. call, and never echoes a credential", () => {
    expect(source).not.toContain("NEXT_PUBLIC_");
    expect(source).not.toMatch(/console\./);
    expect(source).not.toMatch(/credentials?\.(email|password)/);
  });
});
