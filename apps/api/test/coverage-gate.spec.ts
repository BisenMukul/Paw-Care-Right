// T098: static pin over the coverage gate (api services + packages/ai),
// the root/turbo wiring, and the CI step -- so none of these can be
// silently disabled, weakened, or cached-stale. Mirrors the
// `security-ci-gate.spec.ts` idiom (a static read of package manifests +
// `.github/workflows/ci.yml`, never a live CI run).
import { readFileSync } from "node:fs";
import { join } from "node:path";

const API_PACKAGE_JSON_PATH = join(__dirname, "../package.json");
const AI_PACKAGE_JSON_PATH = join(__dirname, "../../../packages/ai/package.json");
const ROOT_PACKAGE_JSON_PATH = join(__dirname, "../../../package.json");
const TURBO_JSON_PATH = join(__dirname, "../../../turbo.json");
const CI_WORKFLOW_PATH = join(__dirname, "../../../.github/workflows/ci.yml");

interface CoverageThreshold {
  global?: { statements?: number; lines?: number; functions?: number; branches?: number };
  [key: string]: { statements?: number; lines?: number; functions?: number; branches?: number } | undefined;
}

interface JestConfigShape {
  collectCoverageFrom?: string[];
  coverageThreshold?: CoverageThreshold;
}

interface PackageJsonShape {
  scripts?: Record<string, string>;
  jest?: JestConfigShape;
}

function readPackageJson(path: string): PackageJsonShape {
  return JSON.parse(readFileSync(path, "utf8")) as PackageJsonShape;
}

/** Slices the named top-level workflow job block (up to the next top-level job or EOF). */
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

describe("coverage gate — apps/api jest config", () => {
  const apiPkg = readPackageJson(API_PACKAGE_JSON_PATH);

  it("collectCoverageFrom includes src/**/*.service.ts", () => {
    expect(apiPkg.jest?.collectCoverageFrom).toContain("src/**/*.service.ts");
  });

  it("the global threshold is at least 80% statements/lines/functions, 70% branches", () => {
    const global = apiPkg.jest?.coverageThreshold?.global;
    expect(global).toBeDefined();
    expect(global!.statements).toBeGreaterThanOrEqual(80);
    expect(global!.lines).toBeGreaterThanOrEqual(80);
    expect(global!.functions).toBeGreaterThanOrEqual(80);
    expect(global!.branches).toBeGreaterThanOrEqual(70);
  });

  it("the per-service-file threshold (added T098, born green: every *.service.ts measured >= 80% statements) is at least 80%", () => {
    const perPath = apiPkg.jest?.coverageThreshold?.["src/**/*.service.ts"];
    expect(perPath).toBeDefined();
    expect(perPath!.statements).toBeGreaterThanOrEqual(80);
  });
});

describe("coverage gate — packages/ai jest config", () => {
  const aiPkg = readPackageJson(AI_PACKAGE_JSON_PATH);

  it("declares a test:cov script", () => {
    expect(aiPkg.scripts?.["test:cov"]).toBe("jest --coverage");
  });

  it("the global threshold is at least 80% statements/lines/functions, 70% branches", () => {
    const global = aiPkg.jest?.coverageThreshold?.global;
    expect(global).toBeDefined();
    expect(global!.statements).toBeGreaterThanOrEqual(80);
    expect(global!.lines).toBeGreaterThanOrEqual(80);
    expect(global!.functions).toBeGreaterThanOrEqual(80);
    expect(global!.branches).toBeGreaterThanOrEqual(70);
  });
});

describe("coverage gate — root + turbo wiring", () => {
  const rootPkg = readPackageJson(ROOT_PACKAGE_JSON_PATH);
  const turboJson = JSON.parse(readFileSync(TURBO_JSON_PATH, "utf8")) as {
    tasks?: Record<string, { cache?: boolean; dependsOn?: string[] }>;
  };

  it("the root package.json declares test:cov (turbo run test:cov)", () => {
    expect(rootPkg.scripts?.["test:cov"]).toBe("turbo run test:cov");
  });

  it("turbo.json declares a test:cov task that is uncached (a stale cache hit would make the 3-cold-run evidence meaningless)", () => {
    expect(turboJson.tasks?.["test:cov"]).toBeDefined();
    expect(turboJson.tasks!["test:cov"]!.cache).toBe(false);
  });
});

describe("coverage gate — CI wiring (build job)", () => {
  const ciSource = readFileSync(CI_WORKFLOW_PATH, "utf8");
  const buildBlock = sliceJobBlock(ciSource, "build");

  it("the build job runs pnpm test:cov", () => {
    expect(buildBlock).toMatch(/^\s*- run: pnpm test:cov\s*$/m);
  });

  it("the test:cov step carries no if: condition (never skippable into a false green)", () => {
    const stepIndex = buildBlock.search(/^\s*- run: pnpm test:cov\s*$/m);
    expect(stepIndex).toBeGreaterThan(-1);

    // Isolate this step's own block: from its `- run:` line up to the next
    // `- name:`/`- run:`/`- uses:` boundary (or end of job block).
    const fromStep = buildBlock.slice(stepIndex);
    const nextBoundaryMatch = /\n\s*- (name|run|uses):/.exec(fromStep.slice(1));
    const stepBlock = nextBoundaryMatch ? fromStep.slice(0, nextBoundaryMatch.index + 1) : fromStep;

    expect(stepBlock).not.toMatch(/if:/);
  });

  it("the build job carries no if: condition at the job level either (T095 review F4 lesson)", () => {
    const firstStepMatch = /\n\s*- (name|run|uses):/.exec(buildBlock);
    expect(firstStepMatch).not.toBeNull();
    const jobPreamble = buildBlock.slice(0, firstStepMatch!.index);

    expect(jobPreamble).not.toMatch(/^\s*if:/m);
  });
});
