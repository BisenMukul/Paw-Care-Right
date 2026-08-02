import fs from "node:fs";
import path from "node:path";

/**
 * T111 step 13 (AC3, static half): proves the `/v1/admin/*` module declares
 * no mutation route and no service performs a Prisma write. Mirrors the
 * class doc-comment's own claim in `admin.controller.ts` ("READ-ONLY: no
 * POST/PUT/PATCH/DELETE handler exists in this module") with a real static
 * scan, not just a comment — and the runtime half
 * (`test/admin-dashboard.e2e-spec.ts`) proves the same thing against a live
 * HTTP server.
 */

const CONTROLLER_PATH = path.join(__dirname, "admin.controller.ts");
const SERVICE_PATHS = [
  path.join(__dirname, "admin-kpis.service.ts"),
  path.join(__dirname, "admin-users.service.ts"),
  path.join(__dirname, "admin-audit.service.ts"),
];

const MUTATION_DECORATOR_PATTERN = /@(Post|Put|Patch|Delete)\(/g;
const GET_DECORATOR_PATTERN = /@Get\(/g;
const PRISMA_WRITE_PATTERN = /prisma\.\w+\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/;
const EXECUTE_RAW_PATTERN = /\$executeRaw/;

describe("admin module is read-only (static proof)", () => {
  const controllerSource = fs.readFileSync(CONTROLLER_PATH, "utf-8");

  it("the controller declares exactly 3 @Get(...) handlers", () => {
    const matches = [...controllerSource.matchAll(GET_DECORATOR_PATTERN)];
    expect(matches).toHaveLength(3);
  });

  it("the controller declares zero @Post/@Put/@Patch/@Delete handlers", () => {
    const matches = [...controllerSource.matchAll(MUTATION_DECORATOR_PATTERN)];
    expect(matches).toHaveLength(0);
  });

  it("no admin service source calls a Prisma write method", () => {
    for (const servicePath of SERVICE_PATHS) {
      const source = fs.readFileSync(servicePath, "utf-8");
      expect(PRISMA_WRITE_PATTERN.test(source)).toBe(false);
    }
  });

  it("no admin service source calls $executeRaw", () => {
    for (const servicePath of SERVICE_PATHS) {
      const source = fs.readFileSync(servicePath, "utf-8");
      expect(EXECUTE_RAW_PATTERN.test(source)).toBe(false);
    }
  });

  it("visited a non-trivial number of files (non-vacuity)", () => {
    expect(SERVICE_PATHS.length).toBeGreaterThanOrEqual(3);
  });

  it("positive control: the mutation-decorator pattern DOES match a planted @Post( fixture", () => {
    const planted = '@Post("kpis")\n  mutate() {}';
    expect([...planted.matchAll(MUTATION_DECORATOR_PATTERN)]).toHaveLength(1);
  });

  it("positive control: the Prisma-write pattern DOES match planted write-method fixtures", () => {
    expect(PRISMA_WRITE_PATTERN.test("await this.prisma.user.create({ data: {} });")).toBe(true);
    expect(PRISMA_WRITE_PATTERN.test("await this.prisma.subscription.upsert({});")).toBe(true);
    expect(PRISMA_WRITE_PATTERN.test("await this.prisma.aiAuditLog.deleteMany({});")).toBe(true);
  });

  it("positive control: the $executeRaw pattern DOES match a planted fixture", () => {
    expect(EXECUTE_RAW_PATTERN.test("await this.prisma.$executeRaw`DELETE FROM \"User\"`;")).toBe(true);
  });

  it("positive control: an ordinary read call does NOT match the write pattern (non-vacuity)", () => {
    expect(PRISMA_WRITE_PATTERN.test("await this.prisma.user.findUnique({ where: { id } });")).toBe(false);
    expect(PRISMA_WRITE_PATTERN.test("await this.prisma.aiAuditLog.findMany({});")).toBe(false);
  });
});
