/**
 * T100 plan step 19 (§6 AC1-d/AC2-c) -- drift guard for
 * `apps/mobile/store-assets/README.md`. House idiom copied from
 * `release-runbook-doc.test.ts`/`state-audit-doc.test.ts` -- see those
 * files' header comments for why `node:fs`/`node:path` are accessed via a
 * locally-typed `require` (no `@types/node` in this workspace).
 */
export {};

declare const __dirname: string;

interface NodeFs {
  readFileSync(path: string, encoding: string): string;
}
interface NodePath {
  join(...parts: string[]): string;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: locally-typed require avoids adding @types/node (a new dep is out of scope), mirrors state-audit-doc.test.ts
const fs = require("node:fs") as NodeFs;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: same as above
const path = require("node:path") as NodePath;

import { ASSET_MANIFEST } from "../store-assets/tools/asset-manifest";
import { DEVICE_PROFILES, SHOT_SET } from "../store-assets/tools/screenshot-profiles";

const README_PATH = path.join(__dirname, "..", "store-assets", "README.md");
const readme = fs.readFileSync(README_PATH, "utf8");

const SECRET_PATTERNS: RegExp[] = [
  /AKIA[0-9A-Z]{16}/,
  new RegExp("\\bsk-" + "[A-Za-z0-9_-]{20,}"),
  new RegExp("AIza" + "[0-9A-Za-z_-]{35}"),
  /-----BEGIN/,
  new RegExp("eyJ" + "[A-Za-z0-9_-]{10,}\\."),
];

describe("apps/mobile/store-assets/README.md (T100)", () => {
  it("contains the required numbered sections", () => {
    for (let n = 1; n <= 11; n += 1) {
      const headingPattern = new RegExp(`^## ${n}\\. `, "m");
      expect(headingPattern.test(readme)).toBe(true);
    }
  });

  it("documents every manifest asset path", () => {
    expect(ASSET_MANIFEST.length).toBeGreaterThanOrEqual(15);
    for (const entry of ASSET_MANIFEST) {
      expect(readme).toContain(entry.path);
    }
  });

  it("documents all four device profiles and their store dimensions", () => {
    expect(DEVICE_PROFILES.length).toBe(4);
    for (const profile of DEVICE_PROFILES) {
      expect(readme).toContain(profile.id);
      expect(readme).toContain(`${profile.width}x${profile.height}`);
    }
  });

  it("documents all 8 shot ids with capture instructions", () => {
    expect(SHOT_SET.length).toBe(8);
    for (const shot of SHOT_SET) {
      expect(readme).toContain(shot.id);
      expect(readme).toContain(shot.route);
    }
  });

  it("documents the founder capture commands and the compose command", () => {
    expect(readme).toContain("xcrun simctl io booted screenshot");
    expect(readme).toContain("adb exec-out screencap -p");
    expect(readme).toContain("pnpm --filter mobile store:screenshots");
    expect(readme).toContain("pnpm --filter mobile assets:generate");
  });

  it("records the expo-doctor verification status honestly", () => {
    expect(readme).toContain("expo-doctor");
    expect(readme).toContain("loop/journal.md");
    expect(readme).toContain("store-assets-manifest.test.ts");
  });

  it("states the honest splash/no-simulator limits (D3/D5/D6)", () => {
    expect(readme).toContain("expo-splash-screen");
    expect(readme).toContain("Caption text is not burned into pixels");
    expect(readme).toContain("No simulator/staging build in this environment");
  });

  it("contains no secret-shaped value", () => {
    for (const pattern of SECRET_PATTERNS) {
      expect(pattern.test(readme)).toBe(false);
    }
  });
});
