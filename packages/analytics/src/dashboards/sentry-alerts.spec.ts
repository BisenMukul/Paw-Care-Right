import { CRASH_FREE_ALERT_NAME, buildCrashFreeAlertRule } from "./sentry-alerts";

// Copied from apps/mobile/__tests__/release-runbook-doc.test.ts (house idiom).
const SECRET_PATTERNS: RegExp[] = [
  /AKIA[0-9A-Z]{16}/,
  new RegExp("\\bsk-" + "[A-Za-z0-9_-]{20,}"),
  new RegExp("AIza" + "[0-9A-Za-z_-]{35}"),
  /-----BEGIN/,
  new RegExp("eyJ" + "[A-Za-z0-9_-]{10,}\\."),
];

describe("sentry-alerts (T103)", () => {
  const rule = buildCrashFreeAlertRule({ projectSlug: "bombaypetcompany-api", environment: "staging" });

  it("builds a metrics-dataset crash-free session rate rule", () => {
    expect(rule.dataset).toBe("metrics");
    expect(rule.aggregate).toContain("percentage(sessions_crashed, sessions)");
  });

  it("warns below a 99% crash-free rate", () => {
    expect(rule.triggers.length).toBe(1);
    expect(rule.triggers[0]?.label).toBe("warning");
    expect(rule.triggers[0]?.alertThreshold).toBe(99);
    expect(rule.thresholdType).toBe(1);
    expect(rule.triggers[0]?.resolveThreshold).toBeGreaterThanOrEqual(99);
  });

  it("targets the project slug and environment it is given", () => {
    expect(rule.projects).toEqual(["bombaypetcompany-api"]);
    expect(rule.environment).toBe("staging");
    expect(rule.name).toBe(CRASH_FREE_ALERT_NAME);
  });

  it("carries no credential in the payload", () => {
    const serialised = JSON.stringify(rule);

    expect(serialised.toLowerCase()).not.toContain("token");
    expect(serialised.toLowerCase()).not.toContain("authorization");
    expect(serialised.toLowerCase()).not.toContain("bearer");

    for (const pattern of SECRET_PATTERNS) {
      expect(pattern.test(serialised)).toBe(false);
    }
  });
});
