import * as fs from "node:fs";
import * as path from "node:path";

import { REFERRAL_GRANT_DAYS, REFERRAL_GRANT_MAX_PER_USER } from "./referral.constants";

/**
 * T108 plan AC8 -- drift guard for `docs/referral-grants.md`, house idiom
 * copied from `packages/analytics/src/experiments/paywall-ab-doc.spec.ts`
 * (`node:fs`/`node:path` only, no new dep). Also implements the static AC6
 * guard: the grant path source files must never reference `Subscription`.
 */

const repoRoot = path.resolve(__dirname, "../../../..");
const docPath = path.resolve(repoRoot, "docs/referral-grants.md");
const doc = fs.readFileSync(docPath, "utf8");

const REQUIRED_SECTION_ANCHORS = [
  "## 1. What a referral grant is",
  "## 2. Grant math (chaining, stacking cap)",
  "## 3. RevenueCat is never touched",
  "## 4. Abuse guards",
  "## 5. Residual abuse vectors (known, accepted)",
  "## 6. Privacy (T091 erasure behaviour)",
  "## 7. `[FOUNDER]` open questions",
];

function extractSection(beginMarker: string, endMarker: string): string {
  const beginIndex = doc.indexOf(beginMarker);
  const endIndex = endMarker === "" ? doc.length : doc.indexOf(endMarker);
  if (beginIndex === -1 || (endMarker !== "" && endIndex === -1) || endIndex < beginIndex) {
    throw new Error(`referral-doc.spec: could not find ${beginMarker}/${endMarker || "<end of doc>"}`);
  }
  return doc.slice(beginIndex, endIndex);
}

describe("docs/referral-grants.md (T108 AC8)", () => {
  it("contains all seven required sections, in order", () => {
    let cursor = -1;
    for (const anchor of REQUIRED_SECTION_ANCHORS) {
      const index = doc.indexOf(anchor);
      expect(index).toBeGreaterThan(cursor);
      cursor = index;
    }
  });

  it("documents the same grant length and lifetime cap as the committed constants", () => {
    expect(doc).toContain(`${REFERRAL_GRANT_DAYS} days`);
    expect(doc).toContain(`${REFERRAL_GRANT_MAX_PER_USER}`);
    expect(doc).toContain(`${REFERRAL_GRANT_MAX_PER_USER * REFERRAL_GRANT_DAYS} days`);
  });

  it("§3 states RevenueCat state is never read or written by the grant path", () => {
    const section = extractSection("## 3. RevenueCat is never touched", "## 4.");
    expect(section.toLowerCase()).toContain("no revenuecat api call");
    expect(section).toContain("Subscription");
    expect(section.toLowerCase()).toContain("never");
  });

  it("names the static doc-drift guard's own two source files", () => {
    const section = extractSection("## 3. RevenueCat is never touched", "## 4.");
    expect(section).toContain("referral-grant.service.ts");
    expect(section).toContain("referral-grant.util.ts");
  });

  describe("AC6 static guard: the grant path never accesses the Subscription table", () => {
    const grantPathFiles = ["referral-grant.service.ts", "referral-grant.util.ts"];
    // Matches an actual prisma call site (`prisma.subscription.*` /
    // `tx.subscription.*`) -- NOT a doc-comment mentioning the `Subscription`
    // model or `SubscriptionRow` type by name (those are fine; only a real
    // query against the table would violate the AC).
    const PRISMA_SUBSCRIPTION_ACCESS_RE = /\.subscription\s*\./i;

    it.each(grantPathFiles)("%s contains no `.subscription.` prisma call site", (filename) => {
      const source = fs.readFileSync(path.resolve(__dirname, filename), "utf8");
      expect(PRISMA_SUBSCRIPTION_ACCESS_RE.test(source)).toBe(false);
    });
  });
});
