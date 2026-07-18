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

describe("tailwind-preset dual-theme semantic tokens (design-system.md §1.1/§1.6, PAWSAATHI-1 plan)", () => {
  const contents = fs.readFileSync(path.join(__dirname, "../tailwind-preset.mjs"), "utf-8");

  const REQUIRED_SEMANTIC_TOKENS: Record<string, string> = {
    '"page-dark":\\s*"#0c140f"': "#0c140f",
    '"card-dark":\\s*"#16241F"': "#16241F",
    '"raised-dark":\\s*"#143026"': "#143026",
    'dark:\\s*"#E7E0D3"': "#E7E0D3",
    '"muted-dark":\\s*"#9AA8A1"': "#9AA8A1",
    '"faint-dark":\\s*"#6E827A"': "#6E827A",
    'dark:\\s*"#1E6B54"': "#1E6B54",
    'bright:\\s*"#2EA57C"': "#2EA57C",
    'warm:\\s*"#FF7A59"': "#FF7A59",
    'lilac:\\s*"#8B7BD8"': "#8B7BD8",
    'amber:\\s*"#F6A623"': "#F6A623",
    'sky:\\s*"#4C9BD6"': "#4C9BD6",
    "hairline:[^}]*dark:\\s*\"#22392F\"": "#22392F",
  };

  for (const [pattern, hex] of Object.entries(REQUIRED_SEMANTIC_TOKENS)) {
    it(`defines the semantic token matching ${pattern} as ${hex}`, () => {
      expect(contents).toMatch(new RegExp(pattern));
    });
  }

  it("defines the weight-keyed fontFamily tokens", () => {
    expect(contents).toMatch(/display:\s*\["BricolageGrotesque_700Bold"\]/);
    expect(contents).toMatch(/"display-semibold":\s*\["BricolageGrotesque_600SemiBold"\]/);
    expect(contents).toMatch(/body:\s*\["PlusJakartaSans_400Regular"\]/);
    expect(contents).toMatch(/"body-semibold":\s*\["PlusJakartaSans_600SemiBold"\]/);
    expect(contents).toMatch(/"body-bold":\s*\["PlusJakartaSans_700Bold"\]/);
  });
});
