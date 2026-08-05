// T089 (plan D7 / M9): CI must stay green with zero Sentry secrets. This is
// a static, string-based assertion on `.github/workflows/ci.yml` (not a
// live CI run) — it proves the gating condition and skip-notice exist, and
// that a mutation dropping the `if:` gate (M9) is caught.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CI_WORKFLOW_PATH = join(__dirname, "../../../.github/workflows/ci.yml");

describe("CI workflow — Sentry source-map upload gating (T089 D7)", () => {
  const ciWorkflow = readFileSync(CI_WORKFLOW_PATH, "utf8");

  it("feeds GIT_SHA from the commit sha (release identity, CLAUDE §1a)", () => {
    expect(ciWorkflow).toContain("GIT_SHA: ${{ github.sha }}");
  });

  it("gates the Sentry source-map upload step on SENTRY_AUTH_TOKEN being present", () => {
    expect(ciWorkflow).toContain("if: env.SENTRY_AUTH_TOKEN != ''");
  });

  it("has an inverse-gated skip-notice step so CI stays green with zero secrets", () => {
    expect(ciWorkflow).toContain("if: env.SENTRY_AUTH_TOKEN == ''");
    expect(ciWorkflow).toContain("Sentry source-map upload skipped");
  });

  it("never runs the upload step unconditionally (mutation guard: dropping the `if:` gate)", () => {
    const uploadStepIndex = ciWorkflow.indexOf("Upload API source maps to Sentry");
    expect(uploadStepIndex).toBeGreaterThan(-1);
    const uploadStepBlock = ciWorkflow.slice(uploadStepIndex, uploadStepIndex + 400);
    expect(uploadStepBlock).toContain("if: env.SENTRY_AUTH_TOKEN != ''");
  });

  it("APP_VERSION carries the '0.0.0' fallback — an unset repo var is the EMPTY STRING, which would defeat the Zod default and fail every env-validated step in tokenless CI (review R3)", () => {
    expect(ciWorkflow).toContain("APP_VERSION: ${{ vars.APP_VERSION || '0.0.0' }}");
    expect(ciWorkflow).not.toMatch(/APP_VERSION: \$\{\{ vars\.APP_VERSION \}\}/);
  });
});
