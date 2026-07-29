/**
 * T100 plan step 15 (§6 AC1-c) -- the mechanical half of AC1 ("Assets pass
 * ... store size specs"): every manifest entry is checked against the real
 * on-disk file for existence, exact dimensions, the declared alpha/colour
 * type, and its byte cap; app.config.js's three referenced asset paths are
 * cross-checked against the manifest so they cannot silently diverge.
 */
export {};

declare const __dirname: string;

interface NodeFs {
  readFileSync(path: string, encoding?: string): string | Uint8Array;
  existsSync(path: string): boolean;
}
interface NodePath {
  join(...parts: string[]): string;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: locally-typed require avoids adding @types/node (a new dep is out of scope), mirrors store-assets/generate-assets.ts
const fs = require("node:fs") as NodeFs;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: same as above
const path = require("node:path") as NodePath;

import { APP_CONFIG_ASSET_IDS, ASSET_MANIFEST } from "../store-assets/tools/asset-manifest";
import { readPngHeader } from "../store-assets/tools/png-decode";

const REPO_ROOT = path.join(__dirname, "..", "..", "..");
const APP_CONFIG_PATH = path.join(__dirname, "..", "app.config.js");
const TAILWIND_PRESET_PATH = path.join(REPO_ROOT, "packages", "config", "tailwind-preset.mjs");

describe("store-assets manifest vs. real assets", () => {
  it("covers all five density buckets and both splash schemes (non-vacuity)", () => {
    expect(ASSET_MANIFEST.length).toBeGreaterThanOrEqual(15);
    const densityIds = ["android-legacy-mdpi", "android-legacy-hdpi", "android-legacy-xhdpi", "android-legacy-xxhdpi", "android-legacy-xxxhdpi"];
    for (const id of densityIds) {
      expect(ASSET_MANIFEST.some((entry) => entry.id === id)).toBe(true);
    }
    expect(ASSET_MANIFEST.some((entry) => entry.id === "splash-preview-light")).toBe(true);
    expect(ASSET_MANIFEST.some((entry) => entry.id === "splash-preview-dark")).toBe(true);
  });

  it("every manifest asset exists on disk", () => {
    for (const entry of ASSET_MANIFEST) {
      const fullPath = path.join(REPO_ROOT, entry.path);
      expect(fs.existsSync(fullPath)).toBe(true);
    }
  });

  it("every asset has the declared width/height", () => {
    for (const entry of ASSET_MANIFEST) {
      const bytes = fs.readFileSync(path.join(REPO_ROOT, entry.path)) as Uint8Array;
      const header = readPngHeader(bytes);
      expect(header.width).toBe(entry.width);
      expect(header.height).toBe(entry.height);
    }
  });

  it("every asset has the declared alpha/colour-type (icon.png and the store icon carry no alpha channel)", () => {
    for (const entry of ASSET_MANIFEST) {
      const bytes = fs.readFileSync(path.join(REPO_ROOT, entry.path)) as Uint8Array;
      const header = readPngHeader(bytes);
      expect(header.colourType).toBe(entry.alpha ? 6 : 2);
    }
    const icon = ASSET_MANIFEST.find((entry) => entry.id === "app-icon")!;
    const storeIcon = ASSET_MANIFEST.find((entry) => entry.id === "store-icon-ios")!;
    expect(icon.alpha).toBe(false);
    expect(storeIcon.alpha).toBe(false);
  });

  it("every asset is under its byte cap", () => {
    for (const entry of ASSET_MANIFEST) {
      const bytes = fs.readFileSync(path.join(REPO_ROOT, entry.path)) as Uint8Array;
      expect(bytes.length).toBeLessThanOrEqual(entry.maxBytes);
      expect(bytes.length).toBeGreaterThan(0);
    }
  });

  it("every asset path app.config.js references is in the manifest", () => {
    const appConfig = fs.readFileSync(APP_CONFIG_PATH, "utf8") as string;
    expect(APP_CONFIG_ASSET_IDS.length).toBeGreaterThanOrEqual(3);
    for (const id of APP_CONFIG_ASSET_IDS) {
      const entry = ASSET_MANIFEST.find((candidate) => candidate.id === id);
      expect(entry).toBeDefined();
      const basename = entry!.path.slice(entry!.path.lastIndexOf("/") + 1);
      expect(appConfig.includes(basename)).toBe(true);
    }
  });

  // Checker fix-round (T100 review Finding 1): the Android adaptive icon's
  // foreground is a transparent-background mark (asset-manifest.ts's
  // "adaptive-icon" entry, `background: null`) -- if the launcher
  // background ever drifts from the brand field colour, the icon reads as a
  // near-blank tile against it. Both values are read fresh from disk (never
  // a hardcoded duplicate of the hex) so this cannot pass by coincidence.
  it("app.config.js android.adaptiveIcon.backgroundColor matches the tailwind-preset brand token", () => {
    const appConfig = fs.readFileSync(APP_CONFIG_PATH, "utf8") as string;
    const preset = fs.readFileSync(TAILWIND_PRESET_PATH, "utf8") as string;

    const backgroundColorMatch = /backgroundColor:\s*"(#[0-9a-fA-F]{6})"/.exec(appConfig);
    expect(backgroundColorMatch).not.toBeNull();
    const adaptiveIconBackgroundColor = backgroundColorMatch![1]!;

    const brand700Match = /\b700:\s*"(#[0-9a-fA-F]{6})"/.exec(preset);
    expect(brand700Match).not.toBeNull();
    const brand700 = brand700Match![1]!;

    expect(adaptiveIconBackgroundColor.toLowerCase()).toBe(brand700.toLowerCase());
    // Non-vacuity: the app.config.js launcher tile must not still be white
    // (the original, unguarded default this check exists to catch).
    expect(adaptiveIconBackgroundColor.toLowerCase()).not.toBe("#ffffff");
  });
});
