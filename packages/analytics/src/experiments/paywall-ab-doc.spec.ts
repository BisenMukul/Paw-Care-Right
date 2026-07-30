import * as fs from "node:fs";
import * as path from "node:path";

import { PAYWALL_EXPERIMENT_ARMS, PAYWALL_EXPERIMENT_KEY, PAYWALL_EXPERIMENT_MIN_SAMPLE_PER_ARM } from "./paywall-ab";

/**
 * T107 plan AC2 -- drift guard for `docs/experiments/paywall-ab.md`, house
 * idiom copied from `../dashboards/observability-doc.spec.ts` /
 * `../store-privacy-doc.spec.ts` (`node:fs`/`node:path` only, no new dep).
 */

const repoRoot = path.resolve(__dirname, "../../../..");
const docPath = path.resolve(repoRoot, "docs/experiments/paywall-ab.md");
const doc = fs.readFileSync(docPath, "utf8");
const eventsPath = path.resolve(__dirname, "../events.ts");
const eventsSource = fs.readFileSync(eventsPath, "utf8");

const REQUIRED_SECTION_ANCHORS = [
  "## 1. Hypothesis",
  "## 2. Arms (what differs)",
  "## 3. Assignment and exposure",
  "## 4. Success metric — trial_start rate",
  "## 5. Minimum sample and the no-peeking guard",
  "## 6. Stop conditions and kill switch",
  "## 7. `[FOUNDER]` PostHog wiring + staging verification",
  "## 8. Honest statement — what was actually executed here",
];

const ANCHOR_TOKEN_RE = /^(apps|packages|docs)\/[\w./-]+\.(ts|tsx|prisma|md)(:\d+(-\d+)?)?$/;

// Copied from `apps/mobile/__tests__/release-runbook-doc.test.ts` (house idiom).
const SECRET_PATTERNS: RegExp[] = [
  /AKIA[0-9A-Z]{16}/,
  new RegExp("\\bsk-" + "[A-Za-z0-9_-]{20,}"),
  new RegExp("AIza" + "[0-9A-Za-z_-]{35}"),
  /-----BEGIN/,
  new RegExp("eyJ" + "[A-Za-z0-9_-]{10,}\\."),
];

function extractSection(beginMarker: string, endMarker: string): string {
  const beginIndex = doc.indexOf(beginMarker);
  const endIndex = endMarker === "" ? doc.length : doc.indexOf(endMarker);
  if (beginIndex === -1 || (endMarker !== "" && endIndex === -1) || endIndex < beginIndex) {
    throw new Error(`paywall-ab-doc.spec: could not find ${beginMarker}/${endMarker || "<end of doc>"}`);
  }
  return doc.slice(beginIndex, endIndex);
}

function extractCitedAnchorPaths(): string[] {
  const tokens = [...doc.matchAll(/`([^`]+)`/g)].map((m) => m[1] as string);
  const paths = new Set<string>();

  for (const token of tokens) {
    if (ANCHOR_TOKEN_RE.test(token)) {
      paths.add(token.split(":")[0] as string);
    }
  }

  return [...paths];
}

/** Every registry key matching `paywall_experiment_*` (both directions checked against the doc below). */
function registryExperimentEventNames(): string[] {
  const matches = [...eventsSource.matchAll(/^ {2}(paywall_experiment_\w+): \{$/gm)];
  return matches.map((m) => m[1] as string);
}

describe("docs/experiments/paywall-ab.md (T107 AC2)", () => {
  it("contains the required sections in order", () => {
    let cursor = -1;
    for (const anchor of REQUIRED_SECTION_ANCHORS) {
      const index = doc.indexOf(anchor);
      expect(index).toBeGreaterThan(cursor);
      cursor = index;
    }
  });

  it("documents the experiment key, both arms and no invented arm", () => {
    expect(doc).toContain(PAYWALL_EXPERIMENT_KEY);

    for (const arm of PAYWALL_EXPERIMENT_ARMS) {
      expect(doc).toContain(`| \`${arm}\``);
    }

    const armSection = extractSection("## 2. Arms (what differs)", "## 3. Assignment");
    const armRows = armSection
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("| `"));
    expect(armRows.length).toBe(PAYWALL_EXPERIMENT_ARMS.length);
  });

  it("documents the same min sample per arm as the committed constant", () => {
    expect(doc).toContain(String(PAYWALL_EXPERIMENT_MIN_SAMPLE_PER_ARM));
    expect(doc).toContain("16 · p̄(1 − p̄) / δ²");
  });

  it("names exactly the two experiment events declared in the registry", () => {
    const registryEvents = registryExperimentEventNames();
    expect(registryEvents.length).toBeGreaterThanOrEqual(2);

    for (const eventName of registryEvents) {
      expect(doc).toContain(eventName);
    }

    const docEventTokens = [...doc.matchAll(/\bpaywall_experiment_\w+\b/g)].map((m) => m[0]);
    expect(docEventTokens.length).toBeGreaterThan(0);
    const invented = docEventTokens.filter((token) => !registryEvents.includes(token));
    expect(invented).toEqual([]);
  });

  it("documents the success metric and its attribution chain", () => {
    expect(doc).toContain("trial_start");
    expect(doc).toContain("logIn");
    expect(doc).toContain("captureForUser");

    const purchasesSource = fs.readFileSync(path.resolve(repoRoot, "apps/mobile/src/billing/purchases.ts"), "utf8");
    const analyticsServiceSource = fs.readFileSync(
      path.resolve(repoRoot, "apps/api/src/analytics/analytics.service.ts"),
      "utf8",
    );
    expect(/\blogIn\b/.test(purchasesSource)).toBe(true);
    expect(/\bcaptureForUser\b/.test(analyticsServiceSource)).toBe(true);
  });

  it("documents the stop conditions incl. an immediate safety stop and the kill switch", () => {
    const stopSection = extractSection("## 6. Stop conditions and kill switch", "## 7.");
    expect(stopSection).toContain("PAYWALL_VARIANT");
    expect(stopSection).toContain("features.paywall");
    expect(stopSection.toLowerCase()).toContain("no peeking");
    expect(stopSection).toMatch(/\b28\s+days?\b/);
    expect(stopSection.toLowerCase()).toContain("safety");
  });

  it("marks the founder-only staging steps", () => {
    const staging = extractSection("## 7.", "## 8.");
    expect(staging).toContain("[FOUNDER");
  });

  it("states honestly that no PostHog API call was executed here", () => {
    const honesty = extractSection("<!-- BEGIN:honesty -->", "<!-- END:honesty -->");
    expect(honesty).toContain("No PostHog API call was executed");
  });

  it("every code anchor cited in the doc resolves to a file that exists", () => {
    const citedPaths = extractCitedAnchorPaths();

    expect(citedPaths.length).toBeGreaterThan(0);

    const missing = citedPaths.filter((p) => !fs.existsSync(path.resolve(repoRoot, p)));
    expect(missing).toEqual([]);
  });

  it("contains no secret-shaped value", () => {
    for (const pattern of SECRET_PATTERNS) {
      expect(pattern.test(doc)).toBe(false);
    }
  });
});
