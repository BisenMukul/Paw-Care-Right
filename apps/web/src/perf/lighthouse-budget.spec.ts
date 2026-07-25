import fs from "node:fs";
import path from "node:path";

// T095 plan step 7 — new pin covering the perf budget, the SEO budget, the
// run count, URL coverage, the no-sandbox exclusion, and that CI actually
// invokes `lhci assert` unconditionally. These tests prove the numbers
// cannot silently disappear or go vacuous (a matrix entry matching zero
// URLs would otherwise pass lighthouse-ci trivially — verified by hand
// while building this plan: a deliberately-mismatching pattern still
// produced "All results processed!" with exit 0).
const WEB_ROOT = path.join(__dirname, "..", "..");
const REPO_ROOT = path.join(WEB_ROOT, "..", "..");
const LIGHTHOUSERC_PATH = path.join(WEB_ROOT, "lighthouserc.json");
const CI_WORKFLOW_PATH = path.join(REPO_ROOT, ".github", "workflows", "ci.yml");
const PERFORMANCE_DOC_PATH = path.join(REPO_ROOT, "docs", "PERFORMANCE.md");

interface AssertMatrixEntry {
  matchingUrlPattern: string;
  assertions: Record<string, [string, { minScore: number }]>;
}

interface Lighthouserc {
  ci: {
    collect: { url: string[]; numberOfRuns: number; startServerCommand?: string; chromeFlags?: string };
    assert: { assertMatrix: AssertMatrixEntry[] };
    upload?: { target: string };
  };
}

function readLighthouserc(): Lighthouserc {
  return JSON.parse(fs.readFileSync(LIGHTHOUSERC_PATH, "utf-8")) as Lighthouserc;
}

const LANDING_URL = "http://localhost:3000/";
const PROGRAMMATIC_URL = "http://localhost:3000/can-dogs-eat/grapes";

describe("lighthouserc pins performance ≥ 0.90 as an error on the landing URL only", () => {
  it("a matrix entry asserts categories:performance >= 0.9 as an error, matching only the landing URL", () => {
    const lighthouserc = readLighthouserc();
    const entry = lighthouserc.ci.assert.assertMatrix.find(
      (candidate) => candidate.assertions["categories:performance"] !== undefined,
    );
    expect(entry).toBeDefined();

    const assertion = entry!.assertions["categories:performance"]!;
    expect(assertion[0]).toBe("error");
    expect(assertion[1].minScore).toBeGreaterThanOrEqual(0.9);

    const pattern = new RegExp(entry!.matchingUrlPattern);
    expect(pattern.test(LANDING_URL)).toBe(true);
    expect(pattern.test(PROGRAMMATIC_URL)).toBe(false);
  });
});

describe("lighthouserc pins SEO ≥ 0.95 as an error on every collected URL", () => {
  it("the catch-all matrix entry asserts categories:seo >= 0.95 as an error, and every collected URL matches its pattern", () => {
    const lighthouserc = readLighthouserc();
    const entry = lighthouserc.ci.assert.assertMatrix.find(
      (candidate) => candidate.assertions["categories:seo"] !== undefined,
    );
    expect(entry).toBeDefined();

    const assertion = entry!.assertions["categories:seo"]!;
    expect(assertion[0]).toBe("error");
    expect(assertion[1].minScore).toBeGreaterThanOrEqual(0.95);

    const pattern = new RegExp(entry!.matchingUrlPattern);
    for (const url of lighthouserc.ci.collect.url) {
      expect(pattern.test(url)).toBe(true);
    }
  });
});

describe("lighthouserc collects the landing and at least one programmatic page, 3 runs", () => {
  it("collect.url contains a bare-origin URL and at least one /can-…-eat/ URL, with numberOfRuns === 3", () => {
    const lighthouserc = readLighthouserc();
    const urls = lighthouserc.ci.collect.url;
    expect(urls.some((url) => /^https?:\/\/[^/]+\/$/.test(url))).toBe(true);
    expect(urls.some((url) => /\/can-[a-z]+-eat\//.test(url))).toBe(true);
    expect(lighthouserc.ci.collect.numberOfRuns).toBe(3);
  });
});

describe("lighthouserc does not bake in --no-sandbox", () => {
  it("the serialized config contains no no-sandbox / chromeFlags — the root workaround stays out of the artifact", () => {
    const raw = fs.readFileSync(LIGHTHOUSERC_PATH, "utf-8");
    expect(raw).not.toMatch(/no-sandbox/i);
    expect(raw).not.toMatch(/chromeFlags/i);
  });
});

describe("CI runs the lighthouse assertion as a required, unconditional job", () => {
  const ciSource = fs.readFileSync(CI_WORKFLOW_PATH, "utf-8");

  it("contains a web-perf-budget: job", () => {
    expect(ciSource).toMatch(/^\s*web-perf-budget:\s*$/m);
  });

  it("the job runs lhci assert --config=./lighthouserc.json", () => {
    expect(ciSource).toContain("lhci assert --config=./lighthouserc.json");
  });

  it("the assert step carries no if: condition — the budget can never be skipped into a false green", () => {
    // Isolate the web-perf-budget job block (up to the next top-level job or EOF).
    const jobStart = ciSource.indexOf("web-perf-budget:");
    expect(jobStart).toBeGreaterThan(-1);
    const rest = ciSource.slice(jobStart);
    const nextJobMatch = /\n {2}[A-Za-z0-9_-]+:\s*\n {4}runs-on:/.exec(rest.slice(1));
    const jobBlock = nextJobMatch ? rest.slice(0, nextJobMatch.index + 1) : rest;

    const assertStepIndex = jobBlock.indexOf("lhci assert --config=./lighthouserc.json");
    expect(assertStepIndex).toBeGreaterThan(-1);

    // Look at the step block immediately preceding+containing the assert run
    // line: find the nearest "- name:" / "- run:" boundary before it and the
    // next one after it, and confirm no `if:` appears in that span.
    const beforeAssert = jobBlock.slice(0, assertStepIndex);
    const stepBoundaryPattern = /\n {6}- (name|run|uses):/g;
    let lastBoundary = -1;
    let match: RegExpExecArray | null;
    while ((match = stepBoundaryPattern.exec(beforeAssert)) !== null) {
      lastBoundary = match.index;
    }
    expect(lastBoundary).toBeGreaterThan(-1);

    const afterAssertStart = jobBlock.slice(lastBoundary + 1);
    const nextBoundaryMatch = /\n {6}- (name|run|uses):/.exec(afterAssertStart.slice(1));
    const stepBlock = nextBoundaryMatch ? afterAssertStart.slice(0, nextBoundaryMatch.index + 1) : afterAssertStart;

    expect(stepBlock).not.toMatch(/if:/);
  });

  it("the job carries no if: condition at the job level either (T095 review F4)", () => {
    // A job-level `if:` (a sibling of `runs-on:`/`steps:`, indented 4 spaces
    // directly under `web-perf-budget:`) would gate the ENTIRE job — every
    // step's own if-freedom is meaningless if the job itself can be skipped.
    // Isolate the preamble between the job name and its first step bullet.
    const jobStart = ciSource.indexOf("web-perf-budget:");
    expect(jobStart).toBeGreaterThan(-1);
    const rest = ciSource.slice(jobStart);
    const firstStepMatch = /\n {6}- (name|run|uses):/.exec(rest);
    expect(firstStepMatch).not.toBeNull();
    const jobPreamble = rest.slice(0, firstStepMatch!.index);

    expect(jobPreamble).not.toMatch(/^\s*if:/m);
  });
});

describe("docs/PERFORMANCE.md carries the budget numbers it claims to enforce", () => {
  it("contains the cold-start budget number and the two web budget numbers", () => {
    const doc = fs.readFileSync(PERFORMANCE_DOC_PATH, "utf-8");
    expect(doc).toMatch(/2500|2\.5/);
    expect(doc).toMatch(/0\.90/);
    expect(doc).toMatch(/0\.95/);
  });
});
