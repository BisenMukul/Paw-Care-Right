import * as fs from "node:fs";
import * as path from "node:path";

import { CRASH_FREE_ALERT_NAME } from "./sentry-alerts";
import {
  ACTIVATION_INSIGHT_NAME,
  DASHBOARD_NAME,
  PAYWALL_INSIGHT_NAME,
  RETENTION_INSIGHT_NAME,
  UNTRACKED_FUNNEL_GAPS,
} from "./posthog-insights";

/**
 * T103 AC1-d -- drift guard for `docs/observability-dashboards.md`, house
 * idiom copied from `store-privacy-doc.spec.ts` / `release-runbook-doc.test.ts`.
 */

const repoRoot = path.resolve(__dirname, "../../../..");
const docPath = path.resolve(repoRoot, "docs/observability-dashboards.md");
const doc = fs.readFileSync(docPath, "utf8");

const REQUIRED_SECTION_ANCHORS = [
  "## 1. Scope",
  "## 2. Tracked events",
  "## 3. Known gaps (G1-G3) and the follow-up card",
  "## 4. PostHog: prerequisites and provisioning",
  "## 5. PostHog: the three insights",
  "## 6. Sentry: crash-free session rate `<99%` warn rule",
  "## 7. `[FOUNDER]` Staging verification (AC2 evidence)",
  "## 8. Re-running / idempotency and exit codes",
  "## 9. Honest statement — what was actually executed here",
];

const REAL_TRACKED_EVENTS = ["first_check_completed", "paywall_view", "trial_start"];

/**
 * Non-event, snake_case-shaped technical tokens that legitimately appear in
 * the doc body: a Sentry metric aggregate field name (not a PostHog event),
 * and an alternate candidate activation-event name mentioned alongside G1's
 * canonical `signup_completed` in gap prose. Anything snake_case-shaped
 * outside this list + the real events + the documented gap event names
 * (`UNTRACKED_FUNNEL_GAPS[].missingEvent`) is treated as an invented,
 * untested event name.
 */
const ALLOWED_NON_EVENT_TOKENS = ["sessions_crashed", "pet_created"];

// Copied from apps/mobile/__tests__/release-runbook-doc.test.ts (house idiom).
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
    throw new Error(`observability-doc.spec: could not find ${beginMarker}/${endMarker}`);
  }
  return doc.slice(beginIndex, endIndex);
}

describe("docs/observability-dashboards.md (T103)", () => {
  it("contains the required sections in order", () => {
    let cursor = -1;
    for (const anchor of REQUIRED_SECTION_ANCHORS) {
      const index = doc.indexOf(anchor);
      expect(index).toBeGreaterThan(cursor);
      cursor = index;
    }
  });

  it("documents every insight and the dashboard by their exact committed names", () => {
    const names = [DASHBOARD_NAME, ACTIVATION_INSIGHT_NAME, PAYWALL_INSIGHT_NAME, RETENTION_INSIGHT_NAME];
    for (const name of names) {
      expect(doc.includes(name)).toBe(true);
    }
  });

  it("lists the three real tracked events and no invented (untested) event name", () => {
    for (const event of REAL_TRACKED_EVENTS) {
      expect(doc.includes(event)).toBe(true);
    }

    const documentedGapEvents = UNTRACKED_FUNNEL_GAPS.map((gap) => gap.missingEvent);
    const allowed = new Set([...REAL_TRACKED_EVENTS, ...documentedGapEvents, ...ALLOWED_NON_EVENT_TOKENS]);

    const snakeCaseTokens = [...doc.matchAll(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g)].map((match) => match[0]);
    // Non-vacuity: the doc always contains at least the 3 real event names.
    expect(snakeCaseTokens.length).toBeGreaterThan(0);

    const invented = snakeCaseTokens.filter((token) => !allowed.has(token));
    expect(invented).toEqual([]);
  });

  it("documents gaps G1-G3 and the follow-up card", () => {
    for (const gap of UNTRACKED_FUNNEL_GAPS) {
      expect(doc.includes(gap.id)).toBe(true);
    }
    expect(doc.toLowerCase()).toContain("follow-up");
  });

  it("documents both provisioning commands and the pnpm build prerequisite", () => {
    expect(doc).toContain("pnpm --filter @bombaypetcompany/api ops:posthog:dashboards");
    expect(doc).toContain("pnpm --filter @bombaypetcompany/api ops:sentry:alerts");
    expect(doc).toContain("--dry-run");
    expect(doc).toContain("pnpm build");
  });

  it("documents the crash-free <99% warn threshold", () => {
    expect(doc).toContain(CRASH_FREE_ALERT_NAME);
    expect(doc).toContain("99%");
    expect(doc.toLowerCase()).toContain("warn");
  });

  it("marks the founder-only steps", () => {
    const staging = extractSection("## 7.", "## 8.");
    const sentry = extractSection("## 6.", "## 7.");
    expect(staging).toContain("[FOUNDER");
    expect(sentry).toContain("[FOUNDER");
  });

  it("states honestly that no PostHog or Sentry API call was made in this environment", () => {
    const honesty = extractSection("<!-- BEGIN:honesty -->", "<!-- END:honesty -->");
    expect(honesty).toContain("No PostHog or Sentry API call was executed");
    expect(honesty).toContain("--dry-run");
  });

  it("contains no secret-shaped value", () => {
    for (const pattern of SECRET_PATTERNS) {
      expect(pattern.test(doc)).toBe(false);
    }
  });
});
