import * as fs from "node:fs";
import * as path from "node:path";

// The preset is a root-level ESM `.mjs` file (see `tailwind-preset.mjs`'s
// own header comment) -- importing it cleanly under this workspace's
// node+ts-jest (CJS) runner is fragile (`ERR_REQUIRE_ESM` / dynamic-import
// down-compile). A `readFileSync` content assertion of the exact §1.1
// key:hex pairs is deterministic and pins the scale without that friction
// (SWEEP-1 plan risk #3).
describe("tailwind-preset brand scale (design-system.md §1.1)", () => {
  const contents = fs.readFileSync(path.join(__dirname, "../tailwind-preset.mjs"), "utf-8");

  const REQUIRED_SHADES: Record<string, string> = {
    50: "#f2f8f6",
    100: "#dcece6",
    200: "#bcdcd2",
    300: "#8fc4b3",
    500: "#2f8f74",
    600: "#27795f",
    700: "#1f6350",
    900: "#123a30",
  };

  for (const [shade, hex] of Object.entries(REQUIRED_SHADES)) {
    it(`defines brand-${shade} as ${hex}`, () => {
      expect(contents).toMatch(new RegExp(`${shade}:\\s*"${hex}"`));
    });
  }

  it("leaves the pre-existing 50/100/500/700/900 shades unchanged", () => {
    // Regression pin: the phantom-token fix must be additive only -- the
    // shades that existed before SWEEP-1 keep their exact hexes.
    expect(contents).toMatch(/50:\s*"#f2f8f6"/);
    expect(contents).toMatch(/100:\s*"#dcece6"/);
    expect(contents).toMatch(/500:\s*"#2f8f74"/);
    expect(contents).toMatch(/700:\s*"#1f6350"/);
    expect(contents).toMatch(/900:\s*"#123a30"/);
  });
});
