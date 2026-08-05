import { defineConfig, devices } from "@playwright/test";

/**
 * T098 Playwright web E2E smoke config. `testDir: "./e2e"` never collides
 * with jest, whose `roots` is `<rootDir>/src`. Chromium only (D5/D9): a
 * single browser keeps the smoke fast and matches the one browser resolved
 * for this environment (see `docs/qa/regression-gate.md` for the resolved
 * revision + install path used locally).
 *
 * `retries: 0` is deliberate (plan D5) — a flake-hunt/stabilization card
 * must not ship a gate that hides flakes behind retries.
 *
 * No `PLAYWRIGHT_BROWSERS_PATH`/`CHROME_PATH`/`--no-sandbox` is baked in
 * here (T085/T095 precedent): container-only environment workarounds stay
 * on the command line for local runs, never in committed config.
 * playwright-core already appends `--no-sandbox` automatically when running
 * as uid 0, so no explicit flag is needed even in this container.
 */
const BASE_URL = "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: BASE_URL },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  webServer: {
    command: "pnpm start",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
