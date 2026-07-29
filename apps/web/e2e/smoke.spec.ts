import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";
import { APP_DISPLAY_NAME } from "@bombaypetcompany/config";

import { buildFoodPageModel } from "../src/food/page-model";
import { buildLandingModel } from "../src/marketing/landing-content";

/**
 * T098 Playwright web E2E smoke (exactly two tests, D6). Expected copy is
 * always DERIVED from the same shared modules the pages themselves render
 * (never hardcoded, CLAUDE §6) — this suite's value is the end-to-end path
 * (real `next build` -> `next start` -> real HTTP -> real DOM), not the
 * string values, which are already unit-pinned elsewhere
 * (`render.spec.tsx`, `strings-detector-lint.spec.ts`).
 *
 * `vetDisclaimerLine` (the source of `strings.disclaimer` in the frozen
 * `../src/strings.ts`) is computed here via a genuinely separate `node`
 * child process rather than an in-process `import`/`require` of
 * `@bombaypetcompany/types`. This environment's Playwright module loader
 * mis-resolves that one workspace package specifically (reproducible via
 * `import`, `require`, and dynamic `import()` alike — a pnpm-symlinked
 * workspace-package resolution quirk in Playwright's own loader, unrelated
 * to any product code; every other workspace package, e.g. `@bombaypetcompany/
 * config` above, resolves correctly). Spawning a plain `node -e` process
 * sidesteps that loader entirely while still deriving the string from the
 * real, frozen source of truth (never hardcoded) — see
 * `docs/qa/regression-gate.md` E2E section for the full investigation.
 */
function expectedDisclaimer(appName: string): string {
  const script = `
    const { vetDisclaimerLine } = require("@bombaypetcompany/types");
    process.stdout.write(vetDisclaimerLine(${JSON.stringify(appName)}));
  `;
  return execFileSync(process.execPath, ["-e", script], {
    cwd: __dirname,
    encoding: "utf8",
  });
}

test("landing renders its hero and the vet disclaimer", async ({ page }) => {
  const model = buildLandingModel(APP_DISPLAY_NAME);

  await page.goto("/");

  await expect(page.locator("h1")).toHaveText(model.hero.title);

  const disclaimer = page.getByTestId("vet-disclaimer");
  await expect(disclaimer).toBeVisible();
  await expect(disclaimer).toContainText(expectedDisclaimer(APP_DISPLAY_NAME));

  await expect(page.getByTestId("landing-emergency-note")).toBeVisible();
});

test("a toxic food page renders the verdict hero and the emergency hotline CTA", async ({ page }) => {
  const model = buildFoodPageModel("can-dogs-eat", "grapes");
  // Fixture precondition, asserted first so a dataset change fails loudly
  // instead of vacuously passing a no-op page visit.
  expect(model).not.toBeNull();
  expect(model!.showHotlineCta).toBe(true);

  await page.goto("/can-dogs-eat/grapes");

  await expect(page.locator("h1")).toHaveText(model!.title);
  await expect(page.getByText(model!.verdictLabel, { exact: true })).toBeVisible();
  await expect(page.getByText(model!.verdictHeadline, { exact: true })).toBeVisible();

  const hotlineCta = page.getByTestId("emergency-hotline-cta");
  await expect(hotlineCta).toBeVisible();
  await expect(hotlineCta.locator('a[href^="tel:"]').first()).toBeVisible();

  // CLAUDE §7 rule 4 — escalation before content: the hotline CTA must
  // appear before the <h1> in DOM order.
  const order = await page.evaluate(() => {
    const cta = document.querySelector('[data-testid="emergency-hotline-cta"]');
    const h1 = document.querySelector("h1");
    if (!cta || !h1) return null;
    // Node.DOCUMENT_POSITION_FOLLOWING (4): h1 follows cta.
    return Boolean(cta.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(order).toBe(true);
});
