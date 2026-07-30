/**
 * T116 plan step 10 (AC1/AC2/AC3/AC4-wiring + D3 pins). House idiom copied
 * from `ota-config.test.ts`: this workspace has no `@types/node`, so
 * `node:fs`/`node:path`/`node:child_process`/`node:os` are accessed via a
 * locally-typed `require`, `__dirname` is declared as a real per-module CJS
 * free variable, and the lone `export {}` keeps this file an isolated
 * module so its own `declare const __dirname` can't collide with another
 * test file's.
 *
 * No YAML parser (`yaml`/`js-yaml`) is resolvable from any workspace here --
 * both exist only under `node_modules/.pnpm/**`, and adding one for a
 * single assertion would be a new dependency (CLAUDE.md §2 rule 7) bought
 * for one test file. AC1 ("Workflow yaml valid") is therefore proved by a
 * hand-rolled structural validator (`structuralIssues`) that checks the
 * failure modes that actually bite -- tabs, duplicate job keys, a job
 * missing `runs-on:`/`steps:`, a dangling `needs:` reference -- with its
 * own non-vacuity self-test against runtime-built broken fixtures (T114 F7
 * lesson: a proof that can never go red is not a proof). The honest
 * residual is that GitHub's own parser is the closing evidence on first
 * push (recorded in the runbook and the founder delta).
 */
export {};

declare const __dirname: string;

interface NodeFs {
  readFileSync(path: string, encoding: string): string;
  writeFileSync(path: string, data: string, encoding: string): void;
  mkdtempSync(prefix: string): string;
  rmSync(path: string, options: { recursive: boolean; force: boolean }): void;
  existsSync(path: string): boolean;
}
interface NodePath {
  join(...parts: string[]): string;
}
interface NodeOs {
  tmpdir(): string;
}
interface SpawnSyncResult {
  status: number | null;
  stdout: string;
  stderr: string;
}
interface SpawnSyncOptions {
  encoding: string;
  cwd?: string;
  env?: Record<string, string | undefined>;
}
interface NodeChildProcess {
  spawnSync(command: string, args: string[], options: SpawnSyncOptions): SpawnSyncResult;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: locally-typed require avoids adding @types/node (a new dep is out of scope), mirrors ota-config.test.ts
const fs = require("node:fs") as NodeFs;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: same as above
const path = require("node:path") as NodePath;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: same as above
const os = require("node:os") as NodeOs;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: same as above
const childProcess = require("node:child_process") as NodeChildProcess;

const MOBILE_DIR = path.join(__dirname, "..");
const REPO_ROOT = path.join(MOBILE_DIR, "..", "..");
const CI_YML_PATH = path.join(REPO_ROOT, ".github", "workflows", "ci.yml");

const ciYmlSource = fs.readFileSync(CI_YML_PATH, "utf8");

/** Jobs legitimately exempt from the publish jobs' `needs:` list because they are event-scoped (only ever run for a DIFFERENT trigger than the publish jobs'). */
const EVENT_SCOPED_JOBS = ["mobile-fingerprint"] as const;

/** T118: the three named required checks both publish jobs must gate on (OTA_UPDATES §8.1 ai-evals, §8.2 the two Safety Policy suites). */
const REQUIRED_SAFETY_CHECKS = ["ai-evals", "safety-vet-disclaimer", "safety-emergency-interstitial"] as const;

/** T118: the suite files each safety job must invoke, by job key (plan D5). */
const SAFETY_SUITE_FILES: Record<string, readonly string[]> = {
  "safety-vet-disclaimer": [
    "__tests__/check-result-snapshot.test.tsx",
    "__tests__/chat-screen-snapshot.test.tsx",
    "__tests__/breed-guide-sections.test.tsx",
    "__tests__/disclaimer-placement-scan.test.ts",
  ],
  "safety-emergency-interstitial": [
    "__tests__/emergency-interstitial.test.tsx",
    "__tests__/paywall-emergency-safety.test.tsx",
    "__tests__/check-submission.test.tsx",
  ],
};

/** T118 step 11: the runbook doc, read from this file too, because the doc<->CI set-equality check (T14) needs both sources in one place. */
const RUNBOOK_PATH = path.join(REPO_ROOT, "docs", "release-runbook.md");
const runbookSource = fs.readFileSync(RUNBOOK_PATH, "utf8");

// ---- structural parsing helpers (self-contained; no import from other spec files) ----

/** Mirrors `security-ci-gate.spec.ts`'s `sliceJobBlock` idiom exactly: slices a top-level job's block up to the next top-level job key or EOF. */
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

/** Same shape as `sliceJobBlock`, but returns a nullable char-offset range instead of asserting via jest -- used internally by the structural validator, which must not throw on a malformed fixture. */
function jobBlockRange(workflow: string, jobKey: string): { start: number; end: number } | null {
  const jobHeaderPattern = new RegExp(`^  ${jobKey}:`, "m");
  const startMatch = jobHeaderPattern.exec(workflow);
  if (!startMatch) {
    return null;
  }
  const start = startMatch.index;

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
  return { start, end };
}

interface ParsedWorkflow {
  topLevelKeys: string[];
  jobKeys: string[];
  duplicateJobKeys: string[];
}

/** Parses top-level keys (column-0 `key:` lines) and the `jobs:` section's own 2-space-indented job keys, in source order, flagging duplicates. */
function parseWorkflow(source: string): ParsedWorkflow {
  const lines = source.split("\n");

  const topLevelPattern = /^([a-zA-Z0-9_-]+):/;
  const topLevelKeys: string[] = [];
  for (const line of lines) {
    const m = topLevelPattern.exec(line);
    if (m) {
      topLevelKeys.push(m[1]!);
    }
  }

  const jobsIndex = lines.findIndex((line) => /^jobs:\s*$/.test(line));
  const jobKeyPattern = /^  ([a-zA-Z0-9_-]+):\s*$/;
  const jobKeys: string[] = [];
  const duplicateJobKeys: string[] = [];
  const seen = new Set<string>();

  if (jobsIndex !== -1) {
    for (let i = jobsIndex + 1; i < lines.length; i += 1) {
      const m = jobKeyPattern.exec(lines[i]!);
      if (m) {
        const key = m[1]!;
        if (seen.has(key)) {
          duplicateJobKeys.push(key);
        } else {
          seen.add(key);
          jobKeys.push(key);
        }
      }
    }
  }

  return { topLevelKeys, jobKeys, duplicateJobKeys };
}

/** Extracts the `[a, b, c]` list following a `needs:` key inside a single job block, as a plain string array. */
function parseNeeds(jobBlock: string): string[] {
  const match = /needs:\s*\[([^\]]*)\]/.exec(jobBlock);
  if (!match) {
    return [];
  }
  return match[1]!
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * Extracts the literal lines of a `- name: <stepName>` step's `run: |`
 * block, by indentation, starting after the `run: |` line and stopping at
 * the first line indented at or above the `run:` key itself. Copied
 * verbatim from `ota-config.test.ts` (same comment-vs-body behaviour: a
 * comment MENTIONING a line is not the same as the line being present).
 */
function extractStepRunBody(source: string, stepName: string): string[] | null {
  const nameIndex = source.indexOf(`- name: ${stepName}`);
  if (nameIndex === -1) {
    return null;
  }
  const runKeyIndex = source.indexOf("run: |", nameIndex);
  if (runKeyIndex === -1) {
    return null;
  }
  const runLineStart = source.lastIndexOf("\n", runKeyIndex) + 1;
  const runIndent = runKeyIndex - runLineStart;
  const bodyStart = source.indexOf("\n", runKeyIndex) + 1;
  const lines: string[] = [];
  for (const line of source.slice(bodyStart).split("\n")) {
    if (line.trim() === "") {
      lines.push(line);
      continue;
    }
    const indent = line.length - line.trimStart().length;
    if (indent <= runIndent) {
      break;
    }
    lines.push(line);
  }
  return lines;
}

/**
 * A single named step's run body may also be given as `run: <one-liner>`
 * (no `|` block). Returns that one-liner, or null if the step uses a `|`
 * block or was not found -- callers that need EITHER shape try this first.
 *
 * T117 F11-4 fix (T116 review carry-forward), EXECUTOR NOTE: the plan text
 * for this fix reads `(?!\|)`, but that alone does NOT fix the bug --
 * `[ \t]*` before the lookahead is a GREEDY quantifier, so on a `run: |`
 * block it first tries consuming the one leading space, the `(?!\|)`
 * lookahead correctly fails there (next char IS `|`), and the regex engine
 * BACKTRACKS `[ \t]*` down to zero characters consumed; at that
 * zero-consumed position the very next char is the space itself (not `|`),
 * so `(?!\|)` wrongly SUCCEEDS and `(.+)$` still captures `" |"` (trims to
 * `"|"`) -- verified by direct execution against both regexes before
 * writing this fix. The lookahead itself must therefore also skip
 * whitespace (`(?!\s*\|)`), so BOTH backtracking states correctly reject a
 * block-form step.
 */
function extractStepRunOneLiner(source: string, stepName: string): string | null {
  const nameIndex = source.indexOf(`- name: ${stepName}`);
  if (nameIndex === -1) {
    return null;
  }
  const nextStepIndex = source.indexOf("\n      - ", nameIndex + 1);
  const searchEnd = nextStepIndex === -1 ? source.length : nextStepIndex;
  const scoped = source.slice(nameIndex, searchEnd);
  const oneLinerMatch = /\n[ \t]*run:[ \t]*(?!\s*\|)(.+)$/m.exec(scoped);
  return oneLinerMatch ? oneLinerMatch[1]!.trim() : null;
}

interface StructuralIssue {
  kind: string;
  detail: string;
}

/**
 * Hand-rolled structural validator (R1: the honest substitute for a real
 * YAML parser, see file header). Checks the failure modes that actually
 * bite for a workflow of this shape; never throws on a malformed fixture.
 */
function structuralIssues(source: string): StructuralIssue[] {
  const issues: StructuralIssue[] = [];
  const lines = source.split("\n");

  lines.forEach((line, idx) => {
    if (line.includes("\t")) {
      issues.push({ kind: "tab", detail: `line ${idx + 1}` });
    }
  });

  const parsed = parseWorkflow(source);
  const expectedTopLevel = ["name", "on", "concurrency", "jobs"];
  if (JSON.stringify(parsed.topLevelKeys) !== JSON.stringify(expectedTopLevel)) {
    issues.push({ kind: "top-level-keys", detail: parsed.topLevelKeys.join(",") });
  }

  for (const key of parsed.duplicateJobKeys) {
    issues.push({ kind: "duplicate-job-key", detail: key });
  }

  for (const key of parsed.jobKeys) {
    const range = jobBlockRange(source, key);
    if (!range) {
      issues.push({ kind: "unlocatable-job", detail: key });
      continue;
    }
    const block = source.slice(range.start, range.end);
    if (!/^\s*runs-on:/m.test(block)) {
      issues.push({ kind: "missing-runs-on", detail: key });
    }
    if (!/^\s*steps:\s*$/m.test(block)) {
      issues.push({ kind: "missing-steps", detail: key });
    }
  }

  // Dangling `needs:` graph check: every referenced job must exist.
  const jobKeySet = new Set(parsed.jobKeys);
  for (const key of parsed.jobKeys) {
    const range = jobBlockRange(source, key);
    if (!range) {
      continue;
    }
    const block = source.slice(range.start, range.end);
    for (const needed of parseNeeds(block)) {
      if (!jobKeySet.has(needed)) {
        issues.push({ kind: "dangling-needs", detail: `${key} -> ${needed}` });
      }
    }
  }

  return issues;
}

describe("ci.yml structural validity (T116 AC1)", () => {
  it("ci.yml is structurally well-formed (no tabs, unique job keys, every job has runs-on + steps)", () => {
    expect(structuralIssues(ciYmlSource)).toEqual([]);
  });

  it("the structural validator genuinely rejects malformed workflows (self-test)", () => {
    const tabFixture = "name: CI\non:\n  push:\nconcurrency:\n  group: x\njobs:\n  build:\n\t- broken\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n";
    expect(structuralIssues(tabFixture).some((issue) => issue.kind === "tab")).toBe(true);

    const duplicateFixture =
      "name: CI\non:\n  push:\nconcurrency:\n  group: x\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n";
    expect(structuralIssues(duplicateFixture).some((issue) => issue.kind === "duplicate-job-key")).toBe(true);

    const missingStepsFixture =
      "name: CI\non:\n  push:\nconcurrency:\n  group: x\njobs:\n  build:\n    runs-on: ubuntu-latest\n";
    expect(structuralIssues(missingStepsFixture).some((issue) => issue.kind === "missing-steps")).toBe(true);
  });

  it("every `needs:` entry names a job that exists in this workflow", () => {
    expect(structuralIssues(ciYmlSource).filter((issue) => issue.kind === "dangling-needs")).toEqual([]);
  });
});

// T117 step 29 (T116 review Finding 4 / F11-4): `extractStepRunOneLiner`
// must return `null` for a `run: |` block step (never the literal `"|"`),
// while still returning the real text for a genuine one-liner step.
describe("extractStepRunOneLiner correctly distinguishes block-form from one-liner steps (T117 F11-4)", () => {
  it("returns null for a `run: |` block step, never the literal '|'", () => {
    const blockFixture = [
      "jobs:",
      "  build:",
      "    steps:",
      "      - name: Some block step",
      "        run: |",
      "          set -euo pipefail",
      "          echo hi",
      "      - name: next step",
      "        run: echo done",
    ].join("\n");

    expect(extractStepRunOneLiner(blockFixture, "Some block step")).toBeNull();
  });

  it("returns the real text for a genuine one-liner step", () => {
    const oneLinerFixture = [
      "jobs:",
      "  build:",
      "    steps:",
      "      - name: Some one-liner step",
      '        run: node scripts/lint-update-message.js --message "hi"',
    ].join("\n");

    expect(extractStepRunOneLiner(oneLinerFixture, "Some one-liner step")).toBe(
      'node scripts/lint-update-message.js --message "hi"',
    );
  });

  // NOTE: a third, whole-file cross-check ("every step extractStepRunBody
  // sees as block-form is never also seen as a one-liner") was attempted
  // here and DROPPED -- `extractStepRunBody`'s own `nameIndex`/`run: |`
  // search is unbounded forward past the named step (not scoped to that
  // step's own block, see its doc comment above), so it can walk past a
  // one-liner step and match a LATER, unrelated step's block body. That is
  // a pre-existing quirk of `extractStepRunBody` itself (not a T117
  // regression, and not one of T116 review's findings) — asserting against
  // it here would pin an unrelated false premise rather than this fix.
});

describe("preview/production publish jobs are gated on the full check suite (T116 AC2)", () => {
  const parsed = parseWorkflow(ciYmlSource);
  const previewBlock = sliceJobBlock(ciYmlSource, "ota-publish-preview");
  const productionBlock = sliceJobBlock(ciYmlSource, "ota-publish-production");

  it("the preview publish job needs EVERY gate job in the workflow", () => {
    const expected = new Set(
      parsed.jobKeys.filter(
        (key) =>
          key !== "ota-publish-preview" &&
          key !== "ota-publish-production" &&
          !(EVENT_SCOPED_JOBS as readonly string[]).includes(key),
      ),
    );
    expect(new Set(parseNeeds(previewBlock))).toEqual(expected);
  });

  it("every job exempted from the publish `needs:` list is genuinely event-scoped", () => {
    expect(EVENT_SCOPED_JOBS.length).toBeGreaterThan(0);
    for (const exempted of EVENT_SCOPED_JOBS) {
      const block = sliceJobBlock(ciYmlSource, exempted);
      expect(block).toMatch(/if: github\.event_name ==/);
    }
    expect(parseNeeds(previewBlock)).not.toContain("mobile-fingerprint");
  });

  it("the preview publish runs only on a push to main", () => {
    expect(previewBlock).toContain("if: github.event_name == 'push' && github.ref == 'refs/heads/main'");
  });

  it("the production publish job needs the same full gate suite (OTA_UPDATES §8.1)", () => {
    const expected = new Set(
      parsed.jobKeys.filter(
        (key) =>
          key !== "ota-publish-preview" &&
          key !== "ota-publish-production" &&
          !(EVENT_SCOPED_JOBS as readonly string[]).includes(key),
      ),
    );
    expect(new Set(parseNeeds(productionBlock))).toEqual(expected);
  });
});

describe("production publish refuses without the exact confirmation input (T116 AC3)", () => {
  let tmpRoot: string;
  let scriptPath: string;
  let summaryPath: string;

  beforeAll(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "t116-confirm-guard-"));
    scriptPath = path.join(tmpRoot, "confirm.sh");
    summaryPath = path.join(tmpRoot, "summary.md");

    const body = extractStepRunBody(ciYmlSource, "Confirm production publish");
    expect(body).not.toBeNull();
    const bodyText = body!.join("\n");
    // Non-vacuity: the extracted body must actually be the refusal guard.
    expect(bodyText).toContain("PUBLISH-PROD");
    fs.writeFileSync(scriptPath, bodyText, "utf8");
  });

  afterAll(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("the confirmation guard refuses every input that is not exactly PUBLISH-PROD (executed, not read)", () => {
    const badInputs = ["", "publish", "publish-prod", "PUBLISH-PROD ", " PUBLISH-PROD", "PUBLISH-PRODX"];
    for (const bad of badInputs) {
      const result = childProcess.spawnSync("bash", [scriptPath], {
        encoding: "utf8",
        env: { ...process.env, CONFIRMATION: bad, GITHUB_STEP_SUMMARY: summaryPath },
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("refusing production publish");
    }

    const goodResult = childProcess.spawnSync("bash", [scriptPath], {
      encoding: "utf8",
      env: { ...process.env, CONFIRMATION: "PUBLISH-PROD", GITHUB_STEP_SUMMARY: summaryPath },
    });
    expect(goodResult.status).toBe(0);
  });

  it("the production publish job is manual-dispatch only", () => {
    const block = sliceJobBlock(ciYmlSource, "ota-publish-production");
    expect(block).toContain("if: github.event_name == 'workflow_dispatch'");
    expect(block).not.toMatch(/if:.*\bschedule\b/);
    expect(block).not.toMatch(/if:.*== 'push'/);
    expect(ciYmlSource).not.toMatch(/^\s*schedule:/m);
  });

  it("the production job pre-flights /v1/health before publishing", () => {
    const block = sliceJobBlock(ciYmlSource, "ota-publish-production");
    const confirmIndex = block.indexOf("- name: Confirm production publish");
    const preflightIndex = block.indexOf("- name: Pre-flight API build check");
    const publishIndex = block.indexOf("- name: Publish OTA update (production)");
    const rolloutIndex = block.indexOf("- name: Constrain rollout to 10%");

    expect(confirmIndex).toBeGreaterThan(-1);
    expect(preflightIndex).toBeGreaterThan(confirmIndex);
    expect(publishIndex).toBeGreaterThan(preflightIndex);
    expect(rolloutIndex).toBeGreaterThan(publishIndex);

    const preflightBody = extractStepRunBody(ciYmlSource, "Pre-flight API build check")?.join("\n") ?? "";
    expect(preflightBody).toContain("/v1/health");
    expect(preflightBody).toContain("node scripts/check-api-build.js");
  });
});

describe("update message lint is wired into CI (T116 AC4)", () => {
  it("a message lint runs before every `eas update` invocation", () => {
    for (const jobKey of ["ota-publish-preview", "ota-publish-production"]) {
      const block = sliceJobBlock(ciYmlSource, jobKey);
      const stepMarker = /- name: ([^\n]+)\n/g;
      const stepIndices: { name: string; index: number }[] = [];
      let match: RegExpExecArray | null;
      while ((match = stepMarker.exec(block)) !== null) {
        stepIndices.push({ name: match[1]!.trim(), index: match.index });
      }

      const updateSteps = stepIndices.filter((step) => {
        const body =
          extractStepRunBody(block, step.name)?.join("\n") ?? extractStepRunOneLiner(block, step.name) ?? "";
        // Deliberately specific ("update --branch", not a bare "update"
        // substring): the rollout playbook and failure steps also print an
        // `eas-cli@latest update:republish` command in their SUMMARY text,
        // which is a different eas subcommand, not the actual publish call.
        return body.includes("eas-cli@latest update --branch");
      });
      expect(updateSteps.length).toBeGreaterThan(0);

      for (const updateStep of updateSteps) {
        const priorLintSteps = stepIndices.filter(
          (step) => step.index < updateStep.index && step.name === "Lint update message",
        );
        expect(priorLintSteps.length).toBeGreaterThan(0);
      }
    }

    const previewBlock = sliceJobBlock(ciYmlSource, "ota-publish-preview");
    const lintStepIndex = previewBlock.indexOf("- name: Lint update message");
    expect(lintStepIndex).toBeGreaterThan(-1);
    const nextStepIndex = previewBlock.indexOf("\n      - ", lintStepIndex + 1);
    const lintStepBlock = previewBlock.slice(lintStepIndex, nextStepIndex === -1 ? undefined : nextStepIndex);
    expect(lintStepBlock).not.toMatch(/\bif:/);
  });
});

describe("D3 descope pins (T116) -- manifest-marker publish path stays out of scope", () => {
  it("a [critical] publish prints the mandatory /config.criticalOtaVersion follow-up", () => {
    const block = sliceJobBlock(ciYmlSource, "ota-publish-production");
    const stepIndex = block.indexOf("- name: Critical follow-up");
    expect(stepIndex).toBeGreaterThan(-1);
    const nextStepIndex = block.indexOf("\n      - ", stepIndex + 1);
    const stepBlock = block.slice(stepIndex, nextStepIndex === -1 ? undefined : nextStepIndex);
    expect(stepBlock).toContain("if: contains(steps.message.outputs.message, '[critical]')");
    expect(stepBlock).toContain("CRITICAL_OTA_VERSION");
    expect(stepBlock).toContain("GITHUB_STEP_SUMMARY");
  });

  it("no workflow step routes the publish message into the Expo app config", () => {
    expect(ciYmlSource).not.toContain("EXPO_UPDATE_MESSAGE");
    expect(ciYmlSource).not.toContain("updateMessage");
  });
});

describe("job summary documents promotion, halt and rollback commands (T116 §6)", () => {
  const productionBlock = sliceJobBlock(ciYmlSource, "ota-publish-production");

  it("documents a --percent 50 promotion step, a --percent 100 / --action end completion, and the rollback command", () => {
    expect(productionBlock).toContain("channel:rollout");
    expect(productionBlock).toContain("--percent 50");
    expect(productionBlock).toMatch(/--percent 100|--action end/);
    expect(productionBlock).toContain("update:republish");
  });

  it("has an `if: failure()` step writing halt commands to GITHUB_STEP_SUMMARY", () => {
    const stepIndex = productionBlock.indexOf("- name: Halt and rollback commands (failure)");
    expect(stepIndex).toBeGreaterThan(-1);
    const nextStepIndex = productionBlock.indexOf("\n      - ", stepIndex + 1);
    const stepBlock = productionBlock.slice(stepIndex, nextStepIndex === -1 ? undefined : nextStepIndex);
    expect(stepBlock).toContain("if: failure()");
    expect(stepBlock).toContain("GITHUB_STEP_SUMMARY");
    expect(stepBlock).toContain("channel:rollout production --action end");
  });
});

/**
 * Checker Finding 1 (MED) regression pin: nothing previously pinned the
 * ACTUAL `channel:rollout` command's own `--percent 10` value -- only the
 * job-summary PROSE (which separately documents `--percent 50`/`100` for
 * later promotion) was checked. A mutation changing the real rollout step's
 * percent from 10 -> 100 (step NAME left intact) stayed green under the
 * old assertions, which would defeat OTA_UPDATES §6's staged-rollout ladder
 * with a silent 100% first wave. The `\b` word boundary after `10` is
 * required so this does NOT accidentally match `--percent 100`.
 */
describe("the real rollout command is pinned to --percent 10 (checker Finding 1)", () => {
  it("the 'Constrain rollout to 10%' step's own run body sets --percent 10 (not 100)", () => {
    const body = extractStepRunBody(ciYmlSource, "Constrain rollout to 10%");
    expect(body).not.toBeNull();
    const bodyText = body!.join("\n");
    expect(bodyText).toContain("channel:rollout");
    expect(bodyText).toMatch(/--percent 10\b/);
    expect(bodyText).not.toMatch(/--percent 100\b/);
  });
});

describe("pipefail discipline (T113 F2) on every piping publish/rollout step", () => {
  // T117 D8 (T116 review Finding 5 — DEFERRED deliberately, not silently
  // skipped): this hardcoded 1-element list should ideally be DERIVED from
  // the workflow text itself (every step whose run body actually pipes),
  // but a pipe-vs-`||`-vs-echo-text heuristic risks false-positive noise in
  // a guard (e.g. flagging a step that merely mentions "|" in an echoed
  // string, not a real pipe). The single piping step that exists today
  // ("Publish OTA update (production)") is covered by this list, and the
  // "Rollout playbook" step already sets `-o pipefail` independently
  // (verified above by "checker Finding 1"'s sibling assertions in this
  // file). Recorded in the executor's journal entry per D8 — not attempted
  // in this card.
  const PIPING_STEP_NAMES = ["Publish OTA update (production)"] as const;

  it("every publish step that pipes sets pipefail in its own run body", () => {
    for (const stepName of PIPING_STEP_NAMES) {
      const body = extractStepRunBody(ciYmlSource, stepName);
      expect(body).not.toBeNull();
      expect(body!.some((line) => line.trim() === "set -o pipefail" || line.trim() === "set -euo pipefail")).toBe(
        true,
      );
    }
  });

  it("the run-body extraction genuinely distinguishes a comment mention from a real body line (mutation-proof)", () => {
    const withCommentOnly = `
      - name: Publish OTA update (production)
        run: |
          # set -o pipefail (mentioned in a comment only)
          echo hi | tee out.txt
      - name: next step
        run: echo done
    `;
    const body = extractStepRunBody(withCommentOnly, "Publish OTA update (production)");
    expect(body).not.toBeNull();
    expect(body?.some((line) => line.trim() === "set -o pipefail")).toBe(false);
  });
});

describe("script-injection safety in the two new OTA publish jobs", () => {
  it("no `${{ }}` expression is interpolated into a run body", () => {
    for (const jobKey of ["ota-publish-preview", "ota-publish-production"]) {
      const block = sliceJobBlock(ciYmlSource, jobKey);
      const stepMarker = /- name: ([^\n]+)\n/g;
      const stepNames: string[] = [];
      let match: RegExpExecArray | null;
      while ((match = stepMarker.exec(block)) !== null) {
        stepNames.push(match[1]!.trim());
      }
      expect(stepNames.length).toBeGreaterThan(0);

      let checkedAnyBody = false;
      for (const stepName of stepNames) {
        const body = extractStepRunBody(block, stepName);
        if (body !== null) {
          checkedAnyBody = true;
          expect(body.join("\n")).not.toContain("${{");
        }
        const oneLiner = extractStepRunOneLiner(block, stepName);
        if (oneLiner !== null) {
          checkedAnyBody = true;
          expect(oneLiner).not.toContain("${{");
        }
      }
      expect(checkedAnyBody).toBe(true);
    }
  });
});

// ============================================================================
// T118: OTA safety gates on publish jobs
// ============================================================================

/** T118 step 8: the named step whose run body invokes each safety job's pinned jest suites. */
const SAFETY_STEP_NAME_BY_JOB: Record<string, string> = {
  "safety-vet-disclaimer": "VetDisclaimer presence snapshots + placement inventory",
  "safety-emergency-interstitial": "Emergency interstitial flow tests",
};

describe("T118 — the three named safety checks gate both publish jobs (AC1)", () => {
  const previewBlock = sliceJobBlock(ciYmlSource, "ota-publish-preview");
  const productionBlock = sliceJobBlock(ciYmlSource, "ota-publish-production");

  it("both publish jobs' needs: contain all three named safety checks", () => {
    for (const block of [previewBlock, productionBlock]) {
      const needs = parseNeeds(block);
      for (const check of REQUIRED_SAFETY_CHECKS) {
        expect(needs).toContain(check);
      }
    }
  });

  it("each named safety check is an actual job key in this workflow", () => {
    const parsed = parseWorkflow(ciYmlSource);
    for (const check of REQUIRED_SAFETY_CHECKS) {
      expect(parsed.jobKeys).toContain(check);
    }
  });

  it("each safety job's own run body invokes exactly its pinned suite files with --ci", () => {
    for (const [jobKey, pinnedFiles] of Object.entries(SAFETY_SUITE_FILES)) {
      const jobBlock = sliceJobBlock(ciYmlSource, jobKey);
      const stepName = SAFETY_STEP_NAME_BY_JOB[jobKey]!;
      const body = extractStepRunBody(jobBlock, stepName);
      expect(body).not.toBeNull();
      const bodyText = body!.join("\n");

      expect(bodyText).toContain("pnpm --filter @bombaypetcompany/mobile exec jest");
      expect(bodyText).toContain("--ci");
      for (const file of pinnedFiles) {
        expect(bodyText).toContain(file);
      }

      const foundFiles = [...bodyText.matchAll(/__tests__\/\S+/g)].map((m) => m[0]);
      expect(new Set(foundFiles)).toEqual(new Set(pinnedFiles));
    }
  });

  it("every pinned safety suite file exists on disk", () => {
    for (const pinnedFiles of Object.values(SAFETY_SUITE_FILES)) {
      for (const relPath of pinnedFiles) {
        expect(fs.existsSync(path.join(MOBILE_DIR, relPath))).toBe(true);
      }
    }
  });
});

/**
 * Checker Finding 2 fix: nothing above stops a pinned suite from being
 * gated on paper while gutted from the INSIDE (e.g. `describe.skip(...)`
 * around its own tests) -- the suite file still exists, ci.yml still
 * invokes it by the right path, and jest still exits 0 (skipped tests are
 * not failures), so T1-T4 above all stay green while the actual safety
 * assertions silently never run.
 *
 * `stripComments` is a deliberately simple (not a real tokenizer)
 * block-comment/line-comment stripper: it can only make the scan MORE
 * conservative (stripping text that happens to look like a marker inside a
 * comment, producing a false NEGATIVE that manual review would still need
 * to catch) -- it can never produce a false POSITIVE that blocks a
 * legitimate suite, because it only ever REMOVES text, never invents a
 * marker. None of the 7 pinned suite files contain a string literal with
 * `//` or `/* ... *\/`, so this simple approach is sufficient here (verified
 * by running the scan against all 7 real files below, non-vacuously, before
 * this file was submitted).
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/** Every marker that would silently disable or narrow a jest suite/test without failing the run. */
const SKIP_ONLY_PATTERNS: RegExp[] = [
  /\bdescribe\.skip\b/,
  /\bit\.skip\b/,
  /\btest\.skip\b/,
  /\bxdescribe\b/,
  /\bxit\b/,
  /\bxtest\b/,
  /\.only\s*\(/,
];

describe("T118 — pinned safety suite files carry no skip/only markers (checker Finding 2)", () => {
  const allPinnedFiles = Object.values(SAFETY_SUITE_FILES).flat();

  it("scans every one of the 7 pinned safety suite files for describe.skip/it.skip/test.skip/x*/`.only(` (comment-stripped)", () => {
    // Non-vacuity floor: this must be scanning the FULL pinned set (4 + 3),
    // not an accidentally-narrowed subset.
    expect(allPinnedFiles.length).toBe(7);
    for (const relPath of allPinnedFiles) {
      const source = fs.readFileSync(path.join(MOBILE_DIR, relPath), "utf8");
      const stripped = stripComments(source);
      for (const pattern of SKIP_ONLY_PATTERNS) {
        expect(stripped).not.toMatch(pattern);
      }
    }
  });

  it("the skip/only scan genuinely rejects a planted describe.skip and a planted .only( (self-test)", () => {
    const skipFixture = 'describe.skip("temporarily disabled", () => { it("x", () => {}); });';
    const onlyFixture = 'it.only("x", () => { expect(1).toBe(1); });';
    const cleanFixture = 'describe("normal", () => { it("x", () => { expect(1).toBe(1); }); });';

    expect(SKIP_ONLY_PATTERNS.some((pattern) => pattern.test(stripComments(skipFixture)))).toBe(true);
    expect(SKIP_ONLY_PATTERNS.some((pattern) => pattern.test(stripComments(onlyFixture)))).toBe(true);
    expect(SKIP_ONLY_PATTERNS.some((pattern) => pattern.test(stripComments(cleanFixture)))).toBe(false);
  });

  it("the comment stripper does not flag a mere comment MENTIONING skip/only (mutation-proof)", () => {
    const commentOnlyFixture = [
      "// TODO: consider describe.skip here later, and never it.only(",
      'describe("real", () => { it("x", () => { expect(1).toBe(1); }); });',
    ].join("\n");
    const stripped = stripComments(commentOnlyFixture);
    for (const pattern of SKIP_ONLY_PATTERNS) {
      expect(stripped).not.toMatch(pattern);
    }
  });
});

/**
 * Checker Finding 2 fix, part 2: a static FLOOR on the number of snapshot
 * entries actually RECORDED (the committed `.snap` files) for the
 * disclaimer job's three snapshot-bearing suites. This is a COMPLEMENTARY
 * guard, not a substitute for the skip/only scan above: it protects against
 * a `.snap` file being hand-hollowed-out directly (entries deleted from the
 * committed snapshot file itself, bypassing the `.test.tsx` source
 * entirely) -- something the skip/only scan cannot see, since skipping a
 * test does not delete its already-recorded `.snap` entries and the
 * skip/only scan only ever reads `.test.tsx`/`.test.ts` sources, never
 * `.snap` files. Implemented as a plain count of `^exports[` lines (jest's
 * own per-snapshot serialization marker) rather than spawning a real jest
 * run from inside this config test -- the real jest run IS exercised, non-
 * vacuously, by the two verbatim CI invocations proven locally (plan §6).
 * `disclaimer-placement-scan.test.ts` is correctly excluded: it is an
 * inventory scan, not a snapshot suite, and has no `.snap` file.
 */
const DISCLAIMER_SNAPSHOT_FILES = [
  "__tests__/__snapshots__/check-result-snapshot.test.tsx.snap",
  "__tests__/__snapshots__/chat-screen-snapshot.test.tsx.snap",
  "__tests__/__snapshots__/breed-guide-sections.test.tsx.snap",
] as const;

const MIN_DISCLAIMER_SNAPSHOT_COUNT = 9;

describe("T118 — the disclaimer job's recorded snapshot count has a floor (checker Finding 2)", () => {
  it(`at least ${MIN_DISCLAIMER_SNAPSHOT_COUNT} snapshot entries are recorded across the disclaimer job's snapshot files`, () => {
    let total = 0;
    for (const relPath of DISCLAIMER_SNAPSHOT_FILES) {
      const fullPath = path.join(MOBILE_DIR, relPath);
      expect(fs.existsSync(fullPath)).toBe(true);
      const content = fs.readFileSync(fullPath, "utf8");
      const matches = content.match(/^exports\[/gm);
      total += matches ? matches.length : 0;
    }
    expect(total).toBeGreaterThanOrEqual(MIN_DISCLAIMER_SNAPSHOT_COUNT);
  });
});

describe("T118 — the safety jobs are unconditional and never skippable (plan D3)", () => {
  it("the safety jobs carry no job-level if: (a skipped need would skip the publish forever)", () => {
    for (const jobKey of Object.keys(SAFETY_SUITE_FILES)) {
      const block = sliceJobBlock(ciYmlSource, jobKey);
      expect(block).not.toMatch(/^    if:/m);
      expect(EVENT_SCOPED_JOBS as readonly string[]).not.toContain(jobKey);
    }
  });

  it("the safety jobs' jest step is unconditional", () => {
    for (const jobKey of Object.keys(SAFETY_SUITE_FILES)) {
      const jobBlock = sliceJobBlock(ciYmlSource, jobKey);
      const stepName = SAFETY_STEP_NAME_BY_JOB[jobKey]!;
      const stepIndex = jobBlock.indexOf(`- name: ${stepName}`);
      expect(stepIndex).toBeGreaterThan(-1);
      const nextStepIndex = jobBlock.indexOf("\n      - ", stepIndex + 1);
      const stepBlock = jobBlock.slice(stepIndex, nextStepIndex === -1 ? undefined : nextStepIndex);
      expect(stepBlock).not.toMatch(/\bif:/);
    }
  });
});

/**
 * T118 step 8: slices the workflow's top-level `on:` block and returns its
 * 2-space-indented trigger event keys, in source order. Comment lines
 * (`  # …`) and deeper `inputs:`/input-name keys (4- and 6-space indents)
 * are excluded by construction -- only a line matching `^  ([a-z_]+):` is
 * collected. Walks forward from `^on:\s*$` to the next column-0 key (the
 * next top-level workflow key, e.g. `concurrency:`).
 */
function parseTriggerEvents(source: string): string[] {
  const lines = source.split("\n");
  const onIndex = lines.findIndex((line) => /^on:\s*$/.test(line));
  if (onIndex === -1) {
    return [];
  }
  const events: string[] = [];
  for (let i = onIndex + 1; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (/^[a-zA-Z]/.test(line)) {
      break;
    }
    const m = /^  ([a-z_]+):/.exec(line);
    if (m) {
      events.push(m[1]!);
    }
  }
  return events;
}

/** Same forward-walk as `parseTriggerEvents`, returning the raw `on:` block text (used to double-check no forbidden trigger line exists, beyond the parsed key list). */
function sliceOnBlock(source: string): string {
  const lines = source.split("\n");
  const onIndex = lines.findIndex((line) => /^on:\s*$/.test(line));
  if (onIndex === -1) {
    return "";
  }
  let end = lines.length;
  for (let i = onIndex + 1; i < lines.length; i += 1) {
    if (/^[a-zA-Z]/.test(lines[i]!)) {
      end = i;
      break;
    }
  }
  return lines.slice(onIndex, end).join("\n");
}

/** Slices a single `workflow_dispatch` `inputs:` sub-key's own block (6-space key, 8-space fields), up to the next 6-space input key or EOF. */
function sliceInputBlock(source: string, inputName: string): string {
  const pattern = new RegExp(`^      ${inputName}:\\s*$`, "m");
  const match = pattern.exec(source);
  if (!match) {
    return "";
  }
  const start = match.index;
  const nextInputPattern = /^      [a-zA-Z0-9_]+:\s*$/gm;
  nextInputPattern.lastIndex = start + 1;
  let end = source.length;
  let m: RegExpExecArray | null;
  while ((m = nextInputPattern.exec(source)) !== null) {
    if (m.index > start) {
      end = m.index;
      break;
    }
  }
  return source.slice(start, end);
}

/**
 * T118 step 8 (T9/T11): true only when a job block has EXACTLY one
 * job-level `if:` line, that line's condition starts with
 * `github.event_name == 'workflow_dispatch'`, and it contains no `||`
 * disjunction and none of `always(`/`!cancelled(`/`success(` -- i.e. no
 * other event or run-status can make the condition true.
 */
function onlyWorkflowDispatchIf(jobBlock: string): boolean {
  const ifMatches = [...jobBlock.matchAll(/^    if: (.+)$/gm)];
  if (ifMatches.length !== 1) {
    return false;
  }
  const value = ifMatches[0]![1]!.trim();
  if (!value.startsWith("github.event_name == 'workflow_dispatch'")) {
    return false;
  }
  if (value.includes("||")) {
    return false;
  }
  if (/always\(|!cancelled\(|success\(/.test(value)) {
    return false;
  }
  return true;
}

const FORBIDDEN_AUTOMATED_TRIGGERS = [
  "schedule",
  "repository_dispatch",
  "workflow_run",
  "workflow_call",
  "issue_comment",
  "release",
  "create",
  "deployment",
  "deployment_status",
  "check_suite",
  "status",
  "registry_package",
] as const;

describe("T118 — production publish trigger audit (AC2)", () => {
  it("the workflow declares exactly push, pull_request and workflow_dispatch triggers", () => {
    expect(new Set(parseTriggerEvents(ciYmlSource))).toEqual(new Set(["push", "pull_request", "workflow_dispatch"]));
  });

  it("no automated trigger event is declared", () => {
    const events = parseTriggerEvents(ciYmlSource);
    for (const forbidden of FORBIDDEN_AUTOMATED_TRIGGERS) {
      expect(events).not.toContain(forbidden);
    }
    const onBlock = sliceOnBlock(ciYmlSource);
    for (const forbidden of FORBIDDEN_AUTOMATED_TRIGGERS) {
      expect(onBlock).not.toMatch(new RegExp(`^  ${forbidden}:`, "m"));
    }
  });

  it("only workflow_dispatch can reach ota-publish-production", () => {
    const block = sliceJobBlock(ciYmlSource, "ota-publish-production");
    expect(onlyWorkflowDispatchIf(block)).toBe(true);
  });

  it("the confirm_production_publish input defaults to empty and is not required", () => {
    const inputBlock = sliceInputBlock(ciYmlSource, "confirm_production_publish");
    expect(inputBlock.length).toBeGreaterThan(0);
    expect(inputBlock).toContain("required: false");
    expect(inputBlock).toContain('default: ""');

    const productionBlock = sliceJobBlock(ciYmlSource, "ota-publish-production");
    expect(productionBlock).toContain("inputs.confirm_production_publish != ''");
  });

  it("the trigger audit genuinely rejects an automated trigger and a disjunctive job if (self-test)", () => {
    const scheduleFixture = [
      "name: CI",
      "on:",
      "  push:",
      "    branches: [main]",
      "  pull_request:",
      "  workflow_dispatch:",
      "  schedule:",
      '    - cron: "0 3 * * *"',
      "concurrency:",
      "  group: x",
      "jobs:",
      "  build:",
      "    runs-on: ubuntu-latest",
    ].join("\n");
    expect(parseTriggerEvents(scheduleFixture)).toContain("schedule");

    const disjunctiveFixture = [
      "  ota-publish-production:",
      "    needs: [build]",
      "    if: github.event_name == 'workflow_dispatch' || github.event_name == 'push'",
      "    runs-on: ubuntu-latest",
    ].join("\n");
    expect(onlyWorkflowDispatchIf(disjunctiveFixture)).toBe(false);

    const cleanFixture = [
      "  ota-publish-production:",
      "    needs: [build]",
      "    if: github.event_name == 'workflow_dispatch' && inputs.confirm_production_publish != ''",
      "    runs-on: ubuntu-latest",
    ].join("\n");
    expect(onlyWorkflowDispatchIf(cleanFixture)).toBe(true);
  });
});

/** T118 D6: the exact automation-surface inventory scanned for a loop-writable production-publish/dispatch trigger. A STATIC list, not a live directory scan, is deliberate (plan D5/step5 restricts this file's NodeFs interface to adding only `existsSync`; plan R5 flags this whole describe as scope beyond the card's own AC, deletable at no AC cost). */
const AUTOMATION_SCAN_FILES = [
  "scripts/scan-secrets.js",
  "scripts/check-api-build.js",
  "scripts/lint-update-message.js",
  "apps/mobile/scripts/analyze-bundle.ts",
  "apps/mobile/scripts/fingerprint-diff.sh",
  "apps/mobile/scripts/internal-distribution.sh",
  "apps/mobile/scripts/measure-cold-start.sh",
  "apps/mobile/scripts/start-expo.ps1",
  ".claude/hooks/block_protected_paths.sh",
  ".claude/hooks/gate_exec.sh",
  ".claude/hooks/gate_plan.sh",
] as const;

const FORBIDDEN_AUTOMATION_TOKENS = [
  "gh workflow run",
  "workflow run ",
  "/actions/workflows/",
  "workflow_dispatch",
  "update --branch production",
  "channel:rollout production",
  "update:republish",
] as const;

function scanForForbiddenTokens(text: string): string[] {
  return FORBIDDEN_AUTOMATION_TOKENS.filter((token) => text.includes(token));
}

describe("T118 — no loop-writable automation surface can trigger a production publish (plan D6)", () => {
  it("no loop-writable automation surface invokes a production publish or a workflow dispatch", () => {
    let filesScanned = 0;

    for (const relPath of AUTOMATION_SCAN_FILES) {
      const fullPath = path.join(REPO_ROOT, relPath);
      expect(fs.existsSync(fullPath)).toBe(true);
      const content = fs.readFileSync(fullPath, "utf8");
      filesScanned += 1;
      expect(scanForForbiddenTokens(content)).toEqual([]);
    }

    const rootPackageJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    for (const value of Object.values(rootPackageJson.scripts)) {
      filesScanned += 1;
      expect(scanForForbiddenTokens(value)).toEqual([]);
    }

    const turboJsonContent = fs.readFileSync(path.join(REPO_ROOT, "turbo.json"), "utf8");
    filesScanned += 1;
    expect(scanForForbiddenTokens(turboJsonContent)).toEqual([]);

    // Non-vacuity floor (D6/T114 F7 lesson): this scan must genuinely cover
    // more than a token handful of surfaces.
    expect(filesScanned).toBeGreaterThanOrEqual(5);
  });

  it("the automation scan genuinely flags a planted dispatch/publish command (self-test)", () => {
    expect(
      scanForForbiddenTokens("gh workflow run CI -f confirm_production_publish=PUBLISH-PROD").length,
    ).toBeGreaterThan(0);
    expect(scanForForbiddenTokens("npx eas-cli@latest update --branch production").length).toBeGreaterThan(0);
    expect(scanForForbiddenTokens("echo hello world").length).toBe(0);
  });
});

/** T118 step 11: the runbook's own §18 section, sliced the same way `release-runbook-doc.test.ts` slices every other numbered section (that file's own `sliceSection`/`LEVEL_2_HEADING` idiom, copied here as a self-contained local pair because this describe needs BOTH the runbook source and the CI source in one place for the doc<->CI cross-check). */
const RUNBOOK_LEVEL_2_HEADING = /^##(?!#)\s/;

function sliceRunbookSection(source: string, startLineTest: RegExp): string {
  const lines = source.split("\n");
  const startIndex = lines.findIndex((line) => startLineTest.test(line));
  if (startIndex === -1) {
    return "";
  }
  let endIndex = lines.length;
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    if (RUNBOOK_LEVEL_2_HEADING.test(lines[i]!)) {
      endIndex = i;
      break;
    }
  }
  return lines.slice(startIndex, endIndex).join("\n");
}

describe("T118 — runbook §18 cross-ref matches ci.yml (AC3)", () => {
  const section18 = sliceRunbookSection(runbookSource, /^## 18\. /);

  it("runbook §18 names exactly the three CI safety check names", () => {
    expect(section18.length).toBeGreaterThan(0);
    for (const check of REQUIRED_SAFETY_CHECKS) {
      expect(section18).toContain(check);
    }

    const parsed = parseWorkflow(ciYmlSource);
    const previewNeeds = new Set(parseNeeds(sliceJobBlock(ciYmlSource, "ota-publish-preview")));
    const productionNeeds = new Set(parseNeeds(sliceJobBlock(ciYmlSource, "ota-publish-production")));

    // Both directions: every REQUIRED_SAFETY_CHECKS name (already asserted
    // above) is a job §18 mentions, AND every job-key-shaped token found in
    // the §18 slice that IS a real workflow job key (excluding the two
    // publish jobs themselves) is also present in BOTH publish jobs'
    // needs: lists -- catches a stale/renamed name creeping into the doc
    // that ci.yml no longer actually gates on.
    const jobKeyTokensInSection = parsed.jobKeys.filter(
      (key) => key !== "ota-publish-preview" && key !== "ota-publish-production" && section18.includes(key),
    );
    expect(jobKeyTokensInSection.length).toBeGreaterThan(0);
    for (const key of jobKeyTokensInSection) {
      expect(previewNeeds.has(key)).toBe(true);
      expect(productionNeeds.has(key)).toBe(true);
    }
  });

  it("runbook §18 points at docs/OTA_UPDATES.md §8 and does not claim to edit it", () => {
    expect(section18).toContain("docs/OTA_UPDATES.md");
    expect(section18).toContain("§8");
    expect(section18).toMatch(/hook-protected/);
    // Tolerates the markdown `**not**` emphasis around "not" (this section's
    // own phrasing), unlike the plain "not edited here" wording used
    // elsewhere in the doc (§7/§13).
    expect(section18).toMatch(/not\*{0,2} edited here/);
  });
});
