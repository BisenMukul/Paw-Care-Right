import * as fs from "node:fs";
import * as path from "node:path";

/**
 * T103 AC1-c -- source-text contract guard over the two ops CLIs
 * (`apps/api/scripts/provision-posthog-dashboards.ts`,
 * `apps/api/scripts/provision-sentry-alerts.ts`) plus the api manifest and
 * tsconfigs that make them runnable and keep them out of the Nest build
 * (plan D3/D4, R1/R4). Pure `node:fs`/`node:path` text parsing -- no process
 * spawning here (the CLIs themselves are exercised as real keyless commands
 * in the executor report, not by this fast unit spec).
 */

const repoRoot = path.resolve(__dirname, "../../../..");
const posthogCliPath = path.resolve(repoRoot, "apps/api/scripts/provision-posthog-dashboards.ts");
const sentryCliPath = path.resolve(repoRoot, "apps/api/scripts/provision-sentry-alerts.ts");
const docPath = path.resolve(repoRoot, "docs/observability-dashboards.md");
const apiPackageJsonPath = path.resolve(repoRoot, "apps/api/package.json");
const apiTsconfigPath = path.resolve(repoRoot, "apps/api/tsconfig.json");
const apiTsconfigBuildPath = path.resolve(repoRoot, "apps/api/tsconfig.build.json");

const posthogCli = fs.readFileSync(posthogCliPath, "utf8");
const sentryCli = fs.readFileSync(sentryCliPath, "utf8");
const doc = fs.readFileSync(docPath, "utf8");
const apiPackageJson = JSON.parse(fs.readFileSync(apiPackageJsonPath, "utf8")) as {
  scripts: Record<string, string>;
};
const apiTsconfig = JSON.parse(fs.readFileSync(apiTsconfigPath, "utf8")) as {
  include: string[];
};
const apiTsconfigBuild = JSON.parse(fs.readFileSync(apiTsconfigBuildPath, "utf8")) as {
  exclude: string[];
};

/** Every unique `process.env.X` name read by a source file. */
function extractEnvReads(source: string): Set<string> {
  const names = new Set<string>();
  for (const match of source.matchAll(/process\.env\.(\w+)/g)) {
    names.add(match[1] as string);
  }
  return names;
}

/** Extracts a `<!-- BEGIN:x --> ... <!-- END:x -->` block (store-privacy-doc.spec.ts idiom). */
function extractDocSection(beginMarker: string, endMarker: string): string {
  const beginIndex = doc.indexOf(beginMarker);
  const endIndex = doc.indexOf(endMarker);
  if (beginIndex === -1 || endIndex === -1 || endIndex < beginIndex) {
    throw new Error(`observability-scripts.spec: could not find ${beginMarker}/${endMarker} in the doc`);
  }
  return doc.slice(beginIndex, endIndex);
}

/** No `console.*` line may interpolate a variable whose name looks like a credential. */
function assertNeverLogsCredential(source: string, credentialVarNames: string[]): void {
  const consoleLines = source.split("\n").filter((line) => /console\.\w+\(/.test(line));
  for (const line of consoleLines) {
    for (const varName of credentialVarNames) {
      expect(line.includes(varName)).toBe(false);
    }
  }
}

describe("observability CLIs (T103 AC1-c)", () => {
  it("reads exactly the documented env vars", () => {
    const posthogEnvSection = extractDocSection("<!-- BEGIN:posthog-env -->", "<!-- END:posthog-env -->");
    const sentryEnvSection = extractDocSection("<!-- BEGIN:sentry-env -->", "<!-- END:sentry-env -->");

    const posthogReads = extractEnvReads(posthogCli);
    const sentryReads = extractEnvReads(sentryCli);

    // Non-vacuity floor.
    expect(posthogReads.size).toBeGreaterThanOrEqual(3);
    expect(sentryReads.size).toBeGreaterThanOrEqual(3);

    for (const name of posthogReads) {
      expect(posthogEnvSection.includes(name)).toBe(true);
    }
    for (const name of sentryReads) {
      expect(sentryEnvSection.includes(name)).toBe(true);
    }
  });

  it("exits 2 when a required env var is missing", () => {
    for (const source of [posthogCli, sentryCli]) {
      expect(source).toContain("process.exit(2)");
      expect(source).toContain("missing required env");
    }
  });

  it("supports --dry-run", () => {
    for (const source of [posthogCli, sentryCli]) {
      expect(source).toContain("--dry-run");
    }
  });

  it("upserts instead of blindly creating", () => {
    for (const source of [posthogCli, sentryCli]) {
      // A list/GET call: a `fetch(url, { headers })` with no `method` (defaults to GET).
      expect(source.includes(", { headers });")).toBe(true);
      // An update branch: an explicit PATCH or PUT method.
      expect(/method: "(PATCH|PUT)"/.test(source)).toBe(true);
      // A create branch: an explicit POST method.
      expect(source.includes('method: "POST"')).toBe(true);
    }
  });

  it("never prints the credential", () => {
    assertNeverLogsCredential(posthogCli, ["personalApiKey", "headers"]);
    assertNeverLogsCredential(sentryCli, ["authToken", "headers"]);
  });

  it("is registered in apps/api/package.json", () => {
    expect(apiPackageJson.scripts["ops:posthog:dashboards"]).toContain("--tsconfig scripts/tsconfig.json");
    expect(apiPackageJson.scripts["ops:posthog:dashboards"]).toContain("provision-posthog-dashboards.ts");
    expect(apiPackageJson.scripts["ops:sentry:alerts"]).toContain("--tsconfig scripts/tsconfig.json");
    expect(apiPackageJson.scripts["ops:sentry:alerts"]).toContain("provision-sentry-alerts.ts");
  });

  it("keeps apps/api/scripts out of the nest build (R1)", () => {
    expect(apiTsconfig.include).toContain("scripts");
    expect(apiTsconfigBuild.exclude).toContain("scripts");
  });
});
