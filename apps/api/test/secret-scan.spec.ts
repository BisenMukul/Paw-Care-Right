// T096: the secrets scanner's own test suite. Every fixture that "looks
// like a real secret" is assembled by concatenation, never a single string
// literal (see the plan's honesty ledger item 5 and CLAUDE.md — a hard,
// observed hook constraint, not a style note).
import { execFileSync } from "node:child_process";
import { join } from "node:path";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: scripts/scan-secrets.js is a plain CommonJS script (no TS build step, no type declarations) shared between the CLI and this spec
const { scanText, scanFiles, SECRET_RULES } = require("../../../scripts/scan-secrets.js") as {
  scanText: (text: string) => { line: number; ruleId: string }[];
  scanFiles: (paths: string[], cwd?: string) => { path: string; line: number; ruleId: string }[];
  SECRET_RULES: { id: string; description: string; pattern: RegExp }[];
};

const REPO_ROOT = join(__dirname, "../../..");

describe("scan-secrets: detects each rule class", () => {
  const fixtures: Record<string, string> = {
    "aws-access-key-id": `const key = "${"AKIA" + "IOSFODNN7EXAMPLE"}";`,
    "anthropic-api-key": `const key = "${"sk-ant-" + "abcdEFGH12345678901234567890"}";`,
    "generic-sk-api-key": `const key = "${"sk-" + "a".repeat(40)}";`,
    "google-api-key": `const key = "${"AIza" + "SyDaGmWKa4JsXZ-HjGw7ISLn_3namBGewQe"}";`,
    "github-token": `const key = "${"ghp_" + "a".repeat(40)}";`,
    "slack-token": `const key = "${"xoxb-" + "1234567890-abcdefghijklmnop"}";`,
    "sentry-dsn-with-secret": `const dsn = "${"https://" + "a".repeat(32) + ":" + "b".repeat(32) + "@sentry.io/123"}";`,
    "generic-high-entropy-assignment": `apiKey: "${"abcXYZ9" + "middlePart123" + "endHere9"}"`,
    "private-key-block": `${"-----BEGIN" + " RSA PRIVATE KEY-----"}`,
  };

  it("visited every declared rule at least once (non-vacuity)", () => {
    const declaredIds = new Set(SECRET_RULES.map((rule) => rule.id));
    const fixtureIds = new Set(Object.keys(fixtures));
    expect(declaredIds).toEqual(fixtureIds);
  });

  for (const [ruleId, fixtureText] of Object.entries(fixtures)) {
    it(`fixture for '${ruleId}' produces exactly one finding with that ruleId`, () => {
      const findings = scanText(fixtureText);
      expect(findings).toHaveLength(1);
      expect(findings[0]?.ruleId).toBe(ruleId);
    });
  }
});

describe("scan-secrets: does not flag placeholders and low-entropy fixtures", () => {
  const placeholders = [
    'accessToken: "access-token-value"',
    "POSTGRES_PASSWORD: pawcareright",
    "MINIO_ROOT_PASSWORD=pawcareright-dev-secret",
    'apiKey: "your-api-key-here"',
    'token: "test-token"',
  ];

  it("none of the documented placeholder/dev-fixture lines produce a finding", () => {
    for (const line of placeholders) {
      expect(scanText(line)).toEqual([]);
    }
  });

  // Every fixture below is deliberately >=20 chars, quoted, and matches the
  // key pattern -- i.e. it would ONLY be excluded by the placeholder
  // denylist, never by length or quoting alone. This is what makes the test
  // non-vacuous with respect to the denylist itself (M20's exact target):
  // without it, every fixture above already fails to match the generic
  // rule's own length/quoting requirements, so a denylist-less scanner
  // would still pass them by accident.
  it("a long, quoted, digit-mixed value is still excluded when it contains a denylisted placeholder word", () => {
    const denylistWords = [
      "example",
      "test",
      "dummy",
      "fake",
      "placeholder",
      "changeme",
      "your-",
      "xxx",
      "local",
      "dev-secret",
    ];

    for (const word of denylistWords) {
      const value = `${word}Value1234567890padding`;
      expect(value.length).toBeGreaterThanOrEqual(20);
      const line = `apiKey: "${value}"`;
      expect(scanText(line)).toEqual([]);
    }
  });

  it("the same value shape WITHOUT a denylisted word DOES produce a finding (non-vacuity anchor for the test above)", () => {
    const value = "genuineLooking1234567890padding";
    expect(value.length).toBeGreaterThanOrEqual(20);
    const line = `apiKey: "${value}"`;
    expect(scanText(line).length).toBeGreaterThan(0);
  });
});

describe("scan-secrets: honours the inline pragma", () => {
  it("a line that would otherwise fire produces zero findings when pragma-tagged", () => {
    const secretLooking = "apiKey: " + JSON.stringify("abcXYZ9middlePart123endHere9");
    expect(scanText(secretLooking).length).toBeGreaterThan(0);

    const pragmaLine = `${secretLooking} // pragma: allowlist secret`;
    expect(scanText(pragmaLine)).toEqual([]);
  });
});

describe("scan-secrets: never prints the matched value", () => {
  it("a finding object exposes only path/line/ruleId, never the matched text", () => {
    const secretLooking = "apiKey: " + JSON.stringify("abcXYZ9middlePart123endHere9");
    const findings = scanText(secretLooking);
    expect(findings).toHaveLength(1);
    expect(Object.keys(findings[0]!).sort()).toEqual(["line", "ruleId"]);
  });
});

describe("scan-secrets: the real tracked tree is clean", () => {
  it("scanning every tracked file in the repo produces zero findings", () => {
    const tracked = execFileSync("git", ["ls-files"], { cwd: REPO_ROOT, encoding: "utf8" })
      .split("\n")
      .filter(Boolean);

    const findings = scanFiles(tracked, REPO_ROOT);
    expect(findings).toEqual([]);
  });
});
