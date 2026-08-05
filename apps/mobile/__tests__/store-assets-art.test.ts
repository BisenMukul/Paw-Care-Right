/**
 * T100 plan step 14 (§6 AC1-b) -- proves the procedural artwork
 * (`raster.ts`'s `renderMark`, D2) is regenerable, respects the alpha
 * contract per manifest entry, keeps the Android adaptive-icon safe zone,
 * and cannot drift from the brand palette source (`packages/config/
 * tailwind-preset.mjs`, F9).
 */
export {};

declare const __dirname: string;

interface NodeFs {
  readFileSync(path: string, encoding: string): string;
}
interface NodePath {
  join(...parts: string[]): string;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: locally-typed require avoids adding @types/node (a new dep is out of scope), mirrors store-assets/generate-assets.ts
const fs = require("node:fs") as NodeFs;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: same as above
const path = require("node:path") as NodePath;

import { ASSET_MANIFEST } from "../store-assets/tools/asset-manifest";
import { BRAND_PALETTE, renderMark, type MarkSpec } from "../store-assets/tools/raster";

const TAILWIND_PRESET_PATH = path.join(__dirname, "..", "..", "..", "packages", "config", "tailwind-preset.mjs");

const OPAQUE_SPEC: MarkSpec = {
  width: 32,
  height: 32,
  background: BRAND_PALETTE.field,
  mark: BRAND_PALETTE.mark,
  markScale: 0.6,
  cornerRadiusRatio: 0,
};

const TRANSPARENT_SPEC: MarkSpec = {
  width: 32,
  height: 32,
  background: null,
  mark: BRAND_PALETTE.field,
  markScale: 0.4,
  cornerRadiusRatio: 0,
};

describe("store-assets artwork (raster.ts)", () => {
  it("renders deterministically (byte-identical across calls)", () => {
    const first = renderMark(OPAQUE_SPEC);
    const second = renderMark(OPAQUE_SPEC);
    expect(Array.from(first)).toEqual(Array.from(second));
  });

  it("renders a fully opaque canvas when a background is given", () => {
    const rgba = renderMark(OPAQUE_SPEC);
    for (let i = 3; i < rgba.length; i += 4) {
      expect(rgba[i]).toBe(255);
    }
  });

  it("renders transparent corners when background is null", () => {
    const rgba = renderMark(TRANSPARENT_SPEC);
    const cornerIndex = 0; // pixel (0,0) alpha byte
    expect(rgba[cornerIndex + 3]).toBe(0);
    const otherCornerIndex = ((TRANSPARENT_SPEC.height - 1) * TRANSPARENT_SPEC.width + (TRANSPARENT_SPEC.width - 1)) * 4;
    expect(rgba[otherCornerIndex + 3]).toBe(0);
  });

  it("keeps the mark inside the Android adaptive-icon 66% safe zone", () => {
    const adaptiveIcon = ASSET_MANIFEST.find((entry) => entry.id === "adaptive-icon");
    expect(adaptiveIcon).toBeDefined();
    expect(adaptiveIcon!.render.markScale).toBeLessThanOrEqual(0.66);
    expect(adaptiveIcon!.render.background).toBeNull();
  });

  it("uses only hexes present in packages/config/tailwind-preset.mjs", () => {
    const preset = fs.readFileSync(TAILWIND_PRESET_PATH, "utf8").toLowerCase();
    for (const hex of Object.values(BRAND_PALETTE)) {
      expect(preset.includes(hex.toLowerCase())).toBe(true);
    }
  });

  it("rejects a malformed hex colour", () => {
    expect(() => renderMark({ ...OPAQUE_SPEC, mark: "not-a-hex" })).toThrow(/hex colour/);
  });
});
