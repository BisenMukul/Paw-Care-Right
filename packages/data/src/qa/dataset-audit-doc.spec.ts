import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

import { allBreedGuides, publishedBreedGuides } from "../breed-guides";
import { catBreeds, dogBreeds } from "../breeds";
import { REGION_HOTLINES } from "../regions";
import { toxins } from "../toxins";

import { computeDatasetAudit, renderDatasetAuditDoc } from "./dataset-audit";

/**
 * T105 AC1 — drift guard for `docs/qa/dataset-audit.md`, house idiom copied
 * from `packages/analytics/src/dashboards/observability-doc.spec.ts`.
 */

const repoRoot = path.resolve(__dirname, "../../../..");
const docPath = path.resolve(repoRoot, "docs/qa/dataset-audit.md");
const doc = readFileSync(docPath, "utf8");

const REQUIRED_SECTION_ANCHORS = [
  "> GENERATED FILE",
  "## 1. Scope & method",
  "## 2. Dataset counts",
  "## 3. Toxin sources list (category-level — T035 R9)",
  "## 4. Top-100 toxin verdict spot-check",
  '### 4.1 How "top 100" is defined',
  "### 4.2 Mechanical checks vs. human checks",
  "### 4.3 The 100 rows",
  "### 4.4 Review queues for [VET] eyes",
  "## 5. Region hotline verification table",
  "## 6. Breed-guide reviewed-flag inventory",
  "## 7. Schema meta-tests (AC2)",
  "## 8. Honest statement — what was NOT verified here",
  "## 9. C3 human to-do delta",
];

// Copied from packages/analytics/src/dashboards/observability-doc.spec.ts (house idiom).
const SECRET_PATTERNS: RegExp[] = [
  /AKIA[0-9A-Z]{16}/,
  new RegExp("\\bsk-" + "[A-Za-z0-9_-]{20,}"),
  new RegExp("AIza" + "[0-9A-Za-z_-]{35}"),
  /-----BEGIN/,
  new RegExp("eyJ" + "[A-Za-z0-9_-]{10,}\\."),
];

function extractSection(beginMarker: string, endMarker: string): string {
  const beginIndex = doc.indexOf(beginMarker);
  const endIndex = doc.indexOf(endMarker);
  if (beginIndex === -1 || endIndex === -1 || endIndex < beginIndex) {
    throw new Error(`dataset-audit-doc.spec: could not find ${beginMarker}/${endMarker}`);
  }
  return doc.slice(beginIndex, endIndex);
}

describe("docs/qa/dataset-audit.md (T105)", () => {
  it("T9 — the committed doc is byte-identical to renderDatasetAuditDoc(computeDatasetAudit())", () => {
    expect(doc).toBe(renderDatasetAuditDoc(computeDatasetAudit()));
  });

  it("T10 — contains the 14 required section anchors in order", () => {
    let cursor = -1;
    for (const anchor of REQUIRED_SECTION_ANCHORS) {
      const index = doc.indexOf(anchor);
      expect(index).toBeGreaterThan(cursor);
      cursor = index;
    }
  });

  it("T11 — marks every hotline row UNVERIFIED and never claims human verification", () => {
    const section5 = extractSection("## 5. Region hotline verification table", "## 6. Breed-guide reviewed-flag inventory");
    const unverifiedCount = (section5.match(/UNVERIFIED/g) ?? []).length;
    expect(unverifiedCount).toBe(REGION_HOTLINES.length);
    expect(section5).toContain("[FOUNDER");

    const stripped = doc.replace(/UNVERIFIED/g, "");
    expect(stripped).not.toContain("VERIFIED");
    expect(stripped).not.toContain("verified by");
    expect(stripped).not.toContain("confirmed by");
  });

  it("T12 — names every dataset it audits with its real count", () => {
    const realCounts = [
      toxins.length,
      dogBreeds.length,
      catBreeds.length,
      REGION_HOTLINES.length,
      allBreedGuides.length,
      publishedBreedGuides.length,
    ];
    for (const count of realCounts) {
      expect(doc).toContain(String(count));
    }

    const section43 = extractSection("### 4.3 The 100 rows", "### 4.4 Review queues for [VET] eyes");
    const dataRowCount = section43.split("\n").filter((rowLine) => /^\| \d+ \|/.test(rowLine)).length;
    expect(dataRowCount).toBe(100);
  });

  it("T13 — every file path the doc references exists on disk", () => {
    const audit = computeDatasetAudit();
    for (const entry of [...audit.metaTests, ...audit.consumerPins]) {
      expect(existsSync(path.resolve(repoRoot, entry.path))).toBe(true);
    }
  });

  it("T14 — states honestly what was not verified", () => {
    const honesty = extractSection("<!-- BEGIN:honesty -->", "<!-- END:honesty -->");
    expect(honesty).toContain("No hotline number was dialled");
    expect(honesty).toContain("No veterinary professional");
    expect(honesty).toContain("no network");
    expect(honesty).toContain("dataset-internal");
  });

  it("T15 — contains no secret-shaped value", () => {
    for (const pattern of SECRET_PATTERNS) {
      expect(pattern.test(doc)).toBe(false);
    }
  });
});
