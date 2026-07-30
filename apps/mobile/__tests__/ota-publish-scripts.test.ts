/**
 * T116 plan step 11 (AC4 + the §5.3 pre-flight logic proof). Drives both
 * `scripts/lint-update-message.js` and `scripts/check-api-build.js` through
 * `spawnSync("node", [SCRIPT_PATH, …])` — the EXACT invocation form CI uses
 * (T113 lesson: prove CI steps via the exact invocation, never an in-process
 * shortcut). All bad fixtures are assembled at runtime from separate parts
 * (id / separator / summary / marker), never committed as a single literal
 * bad string.
 *
 * House idiom (`ota-config.test.ts`): this workspace has no `@types/node`,
 * so `node:path`/`node:child_process` are accessed via a locally-typed
 * `require`, `__dirname` is declared locally, and the lone `export {}` keeps
 * this file an isolated module.
 */
export {};

declare const __dirname: string;

interface NodePath {
  join(...parts: string[]): string;
}
interface SpawnSyncResult {
  status: number | null;
  stdout: string;
  stderr: string;
}
interface NodeChildProcess {
  spawnSync(command: string, args: string[], options: { encoding: string; cwd: string }): SpawnSyncResult;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: locally-typed require avoids adding @types/node (a new dep is out of scope), mirrors ota-config.test.ts
const path = require("node:path") as NodePath;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: same as above
const childProcess = require("node:child_process") as NodeChildProcess;

const REPO_ROOT = path.join(__dirname, "..", "..", "..");
const LINT_SCRIPT_PATH = path.join(REPO_ROOT, "scripts", "lint-update-message.js");
const CHECK_SCRIPT_PATH = path.join(REPO_ROOT, "scripts", "check-api-build.js");

function runLint(args: string[]): SpawnSyncResult {
  return childProcess.spawnSync("node", [LINT_SCRIPT_PATH, ...args], { encoding: "utf8", cwd: REPO_ROOT });
}

function runCheck(args: string[]): SpawnSyncResult {
  return childProcess.spawnSync("node", [CHECK_SCRIPT_PATH, ...args], { encoding: "utf8", cwd: REPO_ROOT });
}

interface BadMessageFixture {
  label: string;
  message: string;
}

/** Every message here is assembled from separate parts, never a single hardcoded bad literal. */
const BAD_MESSAGE_FIXTURES: BadMessageFixture[] = (() => {
  const rows: BadMessageFixture[] = [];

  rows.push({ label: "missing id", message: ["no", "task", "id", "here"].join(" ") });

  const lowerIdParts = { id: "t" + "116", sep: ": ", summary: "fix thing" };
  rows.push({ label: "lowercase id prefix", message: lowerIdParts.id + lowerIdParts.sep + lowerIdParts.summary });

  const shortDigitParts = { id: "T" + "16", sep: ": ", summary: "fix thing" };
  rows.push({
    label: "wrong digit count (Txx instead of Txxx)",
    message: shortDigitParts.id + shortDigitParts.sep + shortDigitParts.summary,
  });

  const noColonParts = { id: "T116", sep: " ", summary: "fix thing" };
  rows.push({ label: "no colon after id", message: noColonParts.id + noColonParts.sep + noColonParts.summary });

  const emptySummaryParts = { id: "T116", sep: ": ", summary: "a" + "b" };
  rows.push({
    label: "summary shorter than 3 non-space characters",
    message: emptySummaryParts.id + emptySummaryParts.sep + emptySummaryParts.summary,
  });

  const core = "T116" + ": " + "fix thing";
  rows.push({ label: "leading whitespace", message: " " + core });
  rows.push({ label: "trailing whitespace", message: core + " " });

  const embeddedNewlineParts = { first: "T116: fix", newline: "\n", second: "thing" };
  rows.push({
    label: "embedded newline",
    message: embeddedNewlineParts.first + embeddedNewlineParts.newline + embeddedNewlineParts.second,
  });

  const upperCriticalParts = { base: "T116: fix thing ", marker: "[" + "CRITICAL" + "]" };
  rows.push({
    label: "[CRITICAL] uppercase",
    message: upperCriticalParts.base + upperCriticalParts.marker,
  });

  const midCriticalParts = { before: "T116: fix ", marker: "[critical]", after: " thing" };
  rows.push({
    label: "[critical] not at the end",
    message: midCriticalParts.before + midCriticalParts.marker + midCriticalParts.after,
  });

  const overLengthParts = { id: "T116: ", summary: "x".repeat(200) };
  rows.push({ label: "over 120 characters", message: overLengthParts.id + overLengthParts.summary });

  return rows;
})();

describe("scripts/lint-update-message.js (T116 AC4)", () => {
  it("rejects every non-conforming update message (table-driven, runtime-built fixtures)", () => {
    for (const fixture of BAD_MESSAGE_FIXTURES) {
      const result = runLint(["--message", fixture.message]);
      expect(result.status).not.toBe(0);
      expect(result.stderr.length).toBeGreaterThan(0);
    }
  });

  it("accepts conforming messages, with and without the [critical] suffix", () => {
    const conforming = [
      "T" + "116" + ": " + "CI publish pipeline",
      "M" + "10" + ": " + "milestone OTA publish",
      "T" + "114" + ": " + "update flow fix" + " " + "[critical]",
    ];
    for (const message of conforming) {
      const result = runLint(["--message", message]);
      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
    }
  });

  it("derives a conforming message from a conventional-commit subject, and fails loudly when the subject carries no task reference", () => {
    const subject = "feat" + "(ota)" + ": " + "T116" + " CI publish pipeline + staged rollout";
    const derived = runLint(["--from-commit", subject]);
    expect(derived.status).toBe(0);
    const lines = derived.stdout.split("\n").filter((line) => line.length > 0);
    expect(lines.length).toBe(1);
    const message = lines[0]!;
    expect(message).toMatch(/^(T\d{3}|M\d{1,2}): \S/);

    const reValidated = runLint(["--message", message]);
    expect(reValidated.status).toBe(0);

    const multiLineSubject = subject + "\n" + "some unrelated body text with T" + "999" + " in it";
    const derivedFromMultiLine = runLint(["--from-commit", multiLineSubject]);
    expect(derivedFromMultiLine.status).toBe(0);
    expect(derivedFromMultiLine.stdout.trim()).toBe(message);

    const noIdSubject = "chore" + ": " + "tidy up";
    const failedDerivation = runLint(["--from-commit", noIdSubject]);
    expect(failedDerivation.status).not.toBe(0);
    expect(failedDerivation.stderr.length).toBeGreaterThan(0);
  });

  // T117 F11-2 (T116 review carry-forward): a bare, ALREADY-conventional
  // subject must derive to itself unchanged, not have its own id consumed
  // by the conventional-commit-prefix strip.
  it("derives a bare 'Txxx: summary' subject to itself unchanged (F11-2 regression pin)", () => {
    const subject = "T" + "117" + ": " + "rollback runbook";
    const derived = runLint(["--from-commit", subject]);

    expect(derived.status).toBe(0);
    expect(derived.stdout.trim()).toBe(subject);
  });

  it("preserves the [critical] suffix on an already-conventional milestone subject (F11-2)", () => {
    const subject = "M" + "10" + ": " + "milestone publish " + "[critical]";
    const derived = runLint(["--from-commit", subject]);

    expect(derived.status).toBe(0);
    expect(derived.stdout.trim()).toBe(subject);
  });

  it("still strips a real conventional-commit prefix when the subject is genuinely conventional-only (regression, both directions)", () => {
    const subject = "feat" + "(ota)" + ": " + "T116" + " CI publish pipeline + staged rollout";
    const derived = runLint(["--from-commit", subject]);

    expect(derived.status).toBe(0);
    expect(derived.stdout.trim()).toBe("T116: CI publish pipeline + staged rollout");
  });
});

describe("scripts/check-api-build.js (T116 §5.3 pre-flight logic)", () => {
  function bodyWith(overrides: Record<string, unknown>): string {
    return JSON.stringify({ status: "ok", db: "ok", redis: "ok", buildId: "abc123", ...overrides });
  }

  it("passes when the API build id exactly matches the expected sha", () => {
    const result = runCheck(["--body", bodyWith({}), "--expect", "abc123"]);
    expect(result.status).toBe(0);
  });

  it("fails closed on a mismatched build id", () => {
    const result = runCheck(["--body", bodyWith({}), "--expect", "def456"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  it("fails closed when status is not exactly 'ok'", () => {
    const result = runCheck(["--body", bodyWith({ status: "degraded" }), "--expect", "abc123"]);
    expect(result.status).not.toBe(0);
  });

  it("fails closed when buildId is missing", () => {
    const body = JSON.stringify({ status: "ok", db: "ok", redis: "ok" });
    const result = runCheck(["--body", body, "--expect", "abc123"]);
    expect(result.status).not.toBe(0);
  });

  it("fails closed on malformed JSON (never throws)", () => {
    const result = runCheck(["--body", "not json", "--expect", "abc123"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  it("fails closed on an empty expectation", () => {
    const result = runCheck(["--body", bodyWith({ buildId: "deadbeef" }), "--expect", ""]);
    expect(result.status).not.toBe(0);
  });

  it("fails closed on a prefix-only match (no 'nearly equal' shortcut)", () => {
    const result = runCheck(["--body", bodyWith({ buildId: "deadbeef" }), "--expect", "deadbee"]);
    expect(result.status).not.toBe(0);
  });
});
