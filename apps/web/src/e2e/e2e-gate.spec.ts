// T098: static pin over the Playwright E2E wiring -- config shape, package
// script, CI job, and the smoke suite's own non-vacuity -- mirrors the
// `lighthouse-budget.spec.ts` / `security-ci-gate.spec.ts` idiom (a static
// read of files, never a live Playwright run under jest).
//
// Fix-round (checker review §0.2/§7 P1): the `playwright.config.ts` checks
// used to be regex string-matches against the WHOLE file, so the JSDoc
// comment's own literal text (e.g. "`retries: 0` is deliberate") satisfied
// the pin even when the real, live `retries`/`testDir` values were changed --
// vacuous. Fixed by importing the ACTUAL config module (this runs under
// jest/ts-jest, a plain CommonJS require -- not Playwright's own test-runner
// loader, which is the thing that mis-resolves `@bombaypetcompany/types`
// elsewhere in this card; `@playwright/test`'s `defineConfig` is a pure
// pass-through with no such issue) and asserting on its RESOLVED values.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import config from "../../playwright.config";

const WEB_ROOT = join(__dirname, "..", "..");
const REPO_ROOT = join(WEB_ROOT, "..", "..");
const WEB_PACKAGE_JSON_PATH = join(WEB_ROOT, "package.json");
const CI_WORKFLOW_PATH = join(REPO_ROOT, ".github", "workflows", "ci.yml");
const SMOKE_SPEC_PATH = join(WEB_ROOT, "e2e", "smoke.spec.ts");

function sliceJobBlock(workflow: string, jobKey: string): string {
  const jobHeaderPattern = new RegExp(`^  ${jobKey}:`, "m");
  const startMatch = jobHeaderPattern.exec(workflow);
  expect(startMatch).not.toBeNull();
  const start = startMatch!.index;

  const nextJobPattern = /^  [a-zA-Z0-9_-]+:\n/gm;
  nextJobPattern.lastIndex = start + 1;
  let nextMatch: RegExpExecArray | null;
  let end = workflow.length;
  while ((nextMatch = nextJobPattern.exec(workflow)) !== null) {
    if (nextMatch.index > start) {
      end = nextMatch.index;
      break;
    }
  }
  return workflow.slice(start, end);
}

describe("playwright.config.ts (resolved values -- immune to the JSDoc-comment-vacuity class)", () => {
  it("testDir resolves to ./e2e (no collision with jest's src roots)", () => {
    expect(config.testDir).toBe("./e2e");
  });

  it("declares exactly one project and it is chromium", () => {
    expect(config.projects).toHaveLength(1);
    expect(config.projects?.[0]?.name).toBe("chromium");
  });

  it("retries resolves to the literal 0 (anti-masking pin -- a flake-hunt card must never hide flakes behind retries)", () => {
    expect(config.retries).toBe(0);
  });

  it("declares a webServer block", () => {
    expect(config.webServer).toBeDefined();
  });
});


describe("apps/web/package.json declares test:e2e", () => {
  it("test:e2e runs playwright test, separately from the jest test script", () => {
    const pkg = JSON.parse(readFileSync(WEB_PACKAGE_JSON_PATH, "utf8")) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.["test:e2e"]).toBe("playwright test");
    expect(pkg.scripts?.test).toBe("jest");
  });
});

describe("CI runs the web E2E smoke as an unconditional required job", () => {
  const ciSource = readFileSync(CI_WORKFLOW_PATH, "utf8");
  const webE2eBlock = sliceJobBlock(ciSource, "web-e2e");

  it("contains a web-e2e: job that runs pnpm --filter @bombaypetcompany/web test:e2e", () => {
    expect(ciSource).toMatch(/^\s*web-e2e:\s*$/m);
    expect(webE2eBlock).toContain("pnpm --filter @bombaypetcompany/web test:e2e");
  });

  it("the test:e2e step carries no if: condition", () => {
    const stepIndex = webE2eBlock.indexOf("pnpm --filter @bombaypetcompany/web test:e2e");
    expect(stepIndex).toBeGreaterThan(-1);

    const beforeStep = webE2eBlock.slice(0, stepIndex);
    const stepBoundaryPattern = /\n\s*- (name|run|uses):/g;
    let lastBoundary = -1;
    let match: RegExpExecArray | null;
    while ((match = stepBoundaryPattern.exec(beforeStep)) !== null) {
      lastBoundary = match.index;
    }
    expect(lastBoundary).toBeGreaterThan(-1);

    const fromStep = webE2eBlock.slice(lastBoundary + 1);
    const nextBoundaryMatch = /\n\s*- (name|run|uses):/.exec(fromStep.slice(1));
    const stepBlock = nextBoundaryMatch ? fromStep.slice(0, nextBoundaryMatch.index + 1) : fromStep;

    expect(stepBlock).not.toMatch(/if:/);
  });

  it("the web-e2e job carries no if: condition at the job level either (T095 review F4 lesson)", () => {
    const firstStepMatch = /\n\s*- (name|run|uses):/.exec(webE2eBlock);
    expect(firstStepMatch).not.toBeNull();
    const jobPreamble = webE2eBlock.slice(0, firstStepMatch!.index);

    expect(jobPreamble).not.toMatch(/^\s*if:/m);
  });
});

describe("apps/web/e2e/smoke.spec.ts", () => {
  // T111: bumped 2 -> 3 (added the unauthenticated `/admin` -> 401 proof).
  it("exists and declares exactly three test( declarations (non-vacuity: cannot silently shrink)", () => {
    const source = readFileSync(SMOKE_SPEC_PATH, "utf8");
    const testDeclarations = [...source.matchAll(/\btest\(\s*["'`]/g)];
    expect(testDeclarations).toHaveLength(3);
  });
});
