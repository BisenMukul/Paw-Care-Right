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
