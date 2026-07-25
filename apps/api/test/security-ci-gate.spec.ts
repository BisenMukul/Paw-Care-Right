// T096: static assertions that the security CI gate exists, is
// unconditional, and cannot be silently weakened, plus a pure validator for
// the audit-allowlist <-> `pnpm.auditConfig.ignoreGhsas` sync contract, and
// the cert-pinning ADR's integrity. Mirrors the `sentry-ci-gate.spec.ts`
// idiom (a static read of `.github/workflows/ci.yml`, not a live CI run).
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CI_WORKFLOW_PATH = join(__dirname, "../../../.github/workflows/ci.yml");
const ROOT_PACKAGE_JSON_PATH = join(__dirname, "../../../package.json");
const ALLOWLIST_PATH = join(__dirname, "../../../docs/security/audit-allowlist.json");
const ADR_PATH = join(__dirname, "../../../docs/adr/0001-mobile-tls-certificate-pinning.md");
const MOBILE_PACKAGE_JSON_PATH = join(__dirname, "../../../apps/mobile/package.json");

type AuditViolation =
  | { kind: "undocumented-suppression"; ghsa: string }
  | { kind: "orphan-allowlist-entry"; ghsa: string }
  | { kind: "expired"; ghsa: string }
  | { kind: "missing-justification"; ghsa: string }
  | { kind: "expiry-too-far"; ghsa: string };

interface AllowlistFile {
  entries: readonly Record<string, unknown>[];
}

const REQUIRED_ALLOWLIST_FIELDS = [
  "ghsa",
  "cve",
  "package",
  "severity",
  "reason",
  "reachability",
  "addedOn",
  "expiresOn",
  "addedBy",
] as const;
const GHSA_PATTERN = /^GHSA(-[0-9a-z]{4}){3}$/;
const MAX_SUPPRESSION_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Pure policy validator: the allowlist file and `ignoreGhsas` must agree in
 * both directions, every entry must carry a real justification, and no
 * suppression may outlive its 90-day expiry. The policy IS the check.
 */
function validateAuditAllowlist(
  ignoreGhsas: readonly string[],
  allowlist: AllowlistFile,
  now: Date,
): AuditViolation[] {
  const violations: AuditViolation[] = [];
  const ignoredSet = new Set(ignoreGhsas);
  const entryByGhsa = new Map<string, Record<string, unknown>>();

  for (const entry of allowlist.entries) {
    const ghsa = typeof entry.ghsa === "string" ? entry.ghsa : "";
    if (ghsa) {
      entryByGhsa.set(ghsa, entry);
    }
  }

  for (const ghsa of ignoredSet) {
    if (!entryByGhsa.has(ghsa)) {
      violations.push({ kind: "undocumented-suppression", ghsa });
    }
  }

  for (const [ghsa, entry] of entryByGhsa) {
    if (!ignoredSet.has(ghsa)) {
      violations.push({ kind: "orphan-allowlist-entry", ghsa });
      continue;
    }

    const reason = typeof entry.reason === "string" ? entry.reason.trim() : "";
    const reachability = typeof entry.reachability === "string" ? entry.reachability.trim() : "";
    if (reason.length === 0 || reason.toUpperCase() === "TODO" || reachability.length === 0) {
      violations.push({ kind: "missing-justification", ghsa });
      continue;
    }

    const expiresOn = typeof entry.expiresOn === "string" ? new Date(entry.expiresOn) : null;
    const addedOn = typeof entry.addedOn === "string" ? new Date(entry.addedOn) : null;
    if (!expiresOn || Number.isNaN(expiresOn.getTime())) {
      violations.push({ kind: "missing-justification", ghsa });
      continue;
    }

    if (expiresOn.getTime() < now.getTime()) {
      violations.push({ kind: "expired", ghsa });
      continue;
    }

    if (addedOn && !Number.isNaN(addedOn.getTime())) {
      const spanDays = (expiresOn.getTime() - addedOn.getTime()) / MS_PER_DAY;
      if (spanDays > MAX_SUPPRESSION_DAYS) {
        violations.push({ kind: "expiry-too-far", ghsa });
      }
    }
  }

  return violations;
}

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

describe("CI workflow — security job (T096 AC1)", () => {
  const ciWorkflow = readFileSync(CI_WORKFLOW_PATH, "utf8");
  const securityBlock = sliceJobBlock(ciWorkflow, "security");

  it("defines a `security` job that runs pnpm audit at --audit-level high", () => {
    expect(ciWorkflow).toContain("security:");
    expect(securityBlock).toContain("pnpm audit --audit-level high");
  });

  it("the audit step is unconditional (never skippable into a false green)", () => {
    expect(securityBlock).not.toMatch(/^\s*if:/m);
  });

  it("runs the secrets scan over tracked files, also unconditionally", () => {
    expect(securityBlock).toContain("node scripts/scan-secrets.js --tracked");
  });

  it("does not weaken the audit level anywhere in the workflow", () => {
    expect(ciWorkflow).not.toMatch(/--audit-level (moderate|low|critical)/);
  });
});

describe("audit allowlist <-> pnpm.auditConfig.ignoreGhsas sync (T096 AC2)", () => {
  const FIXED_NOW = new Date("2026-07-25T00:00:00.000Z");

  it("a GHSA ignored in package.json with no allowlist entry is a violation (non-vacuity anchor)", () => {
    const violations = validateAuditAllowlist(["GHSA-aaaa-bbbb-cccc"], { entries: [] }, FIXED_NOW);
    expect(violations).toContainEqual({ kind: "undocumented-suppression", ghsa: "GHSA-aaaa-bbbb-cccc" });
  });

  it("an allowlist entry that is not actually suppressed is a violation", () => {
    const entry = {
      ghsa: "GHSA-aaaa-bbbb-cccc",
      cve: "",
      package: "foo@1.0.0",
      severity: "high",
      reason: "real reason",
      reachability: "real reachability",
      addedOn: "2026-07-25",
      expiresOn: "2026-08-25",
      addedBy: "T096",
    };
    const violations = validateAuditAllowlist([], { entries: [entry] }, FIXED_NOW);
    expect(violations).toContainEqual({ kind: "orphan-allowlist-entry", ghsa: "GHSA-aaaa-bbbb-cccc" });
  });

  it("an expired entry is a violation", () => {
    const entry = {
      ghsa: "GHSA-aaaa-bbbb-cccc",
      cve: "",
      package: "foo@1.0.0",
      severity: "high",
      reason: "real reason",
      reachability: "real reachability",
      addedOn: "2026-01-01",
      expiresOn: "2026-01-02", // one day before FIXED_NOW
      addedBy: "T096",
    };
    const violations = validateAuditAllowlist(["GHSA-aaaa-bbbb-cccc"], { entries: [entry] }, FIXED_NOW);
    expect(violations).toContainEqual({ kind: "expired", ghsa: "GHSA-aaaa-bbbb-cccc" });
  });

  it("an entry with an empty/placeholder justification is a violation", () => {
    const base = {
      ghsa: "GHSA-aaaa-bbbb-cccc",
      cve: "",
      package: "foo@1.0.0",
      severity: "high",
      addedOn: "2026-07-25",
      expiresOn: "2026-08-25",
      addedBy: "T096",
    };

    const emptyReason = validateAuditAllowlist(
      ["GHSA-aaaa-bbbb-cccc"],
      { entries: [{ ...base, reason: "", reachability: "real" }] },
      FIXED_NOW,
    );
    expect(emptyReason).toContainEqual({ kind: "missing-justification", ghsa: "GHSA-aaaa-bbbb-cccc" });

    const todoReason = validateAuditAllowlist(
      ["GHSA-aaaa-bbbb-cccc"],
      { entries: [{ ...base, reason: "TODO", reachability: "real" }] },
      FIXED_NOW,
    );
    expect(todoReason).toContainEqual({ kind: "missing-justification", ghsa: "GHSA-aaaa-bbbb-cccc" });

    const missingReachability = validateAuditAllowlist(
      ["GHSA-aaaa-bbbb-cccc"],
      { entries: [{ ...base, reason: "real reason", reachability: "" }] },
      FIXED_NOW,
    );
    expect(missingReachability).toContainEqual({ kind: "missing-justification", ghsa: "GHSA-aaaa-bbbb-cccc" });
  });

  it("an expiry more than 90 days out is a violation", () => {
    const entry = {
      ghsa: "GHSA-aaaa-bbbb-cccc",
      cve: "",
      package: "foo@1.0.0",
      severity: "high",
      reason: "real reason",
      reachability: "real reachability",
      addedOn: "2026-07-25",
      expiresOn: "2026-11-22", // +120 days
      addedBy: "T096",
    };
    const violations = validateAuditAllowlist(["GHSA-aaaa-bbbb-cccc"], { entries: [entry] }, FIXED_NOW);
    expect(violations).toContainEqual({ kind: "expiry-too-far", ghsa: "GHSA-aaaa-bbbb-cccc" });
  });

  it("a fully valid entry produces zero violations (non-vacuity: the validator can also say yes)", () => {
    const entry = {
      ghsa: "GHSA-aaaa-bbbb-cccc",
      cve: "",
      package: "foo@1.0.0",
      severity: "high",
      reason: "real reason",
      reachability: "real reachability",
      addedOn: "2026-07-25",
      expiresOn: "2026-08-25",
      addedBy: "T096",
    };
    const violations = validateAuditAllowlist(["GHSA-aaaa-bbbb-cccc"], { entries: [entry] }, FIXED_NOW);
    expect(violations).toEqual([]);
  });

  it("every suppressed advisory in the REAL repo is documented and unexpired", () => {
    const pkgJson = JSON.parse(readFileSync(ROOT_PACKAGE_JSON_PATH, "utf8")) as {
      pnpm?: { auditConfig?: { ignoreGhsas?: string[] } };
    };
    const allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8")) as AllowlistFile;
    const ignoreGhsas = pkgJson.pnpm?.auditConfig?.ignoreGhsas ?? [];

    const violations = validateAuditAllowlist(ignoreGhsas, allowlist, new Date());
    expect(violations).toEqual([]);
  });

  it("the allowlist file parses and matches the documented shape", () => {
    const allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8")) as AllowlistFile;
    expect(Array.isArray(allowlist.entries)).toBe(true);

    for (const entry of allowlist.entries) {
      for (const field of REQUIRED_ALLOWLIST_FIELDS) {
        expect(typeof entry[field]).toBe("string");
      }
      expect(entry.ghsa as string).toMatch(GHSA_PATTERN);
    }
  });
});

describe("cert-pinning ADR integrity (T096 Phase F)", () => {
  const adr = readFileSync(ADR_PATH, "utf8");
  const mobilePackageJson = readFileSync(MOBILE_PACKAGE_JSON_PATH, "utf8");

  it("exists and records a Deferred decision", () => {
    expect(adr).toMatch(/Status:\s*Deferred/);
  });

  it("has all four required sections", () => {
    expect(adr).toContain("## Context");
    expect(adr).toContain("## Decision");
    expect(adr).toContain("## Consequences");
    expect(adr).toContain("## Revisit triggers");
  });

  it("explicitly states nothing is implemented", () => {
    expect(adr).toMatch(/not implemented/i);
  });

  it("no certificate-pinning dependency was actually added to apps/mobile", () => {
    expect(mobilePackageJson).not.toMatch(/ssl-pinning|trustkit|cert-pinning/i);
  });
});
