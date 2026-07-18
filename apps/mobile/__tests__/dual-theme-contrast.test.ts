// PAWSAATHI-1 plan: self-contained hex map (mirrors the new
// `tailwind-preset.mjs` semantic dark tokens + the pre-existing brand
// scale) + a local WCAG relative-luminance/ratio implementation (copied
// from `urgency-contrast.test.ts` rather than imported, so this evidence
// can't silently drift with a shared-helper change). Asserts every NEW
// text-bearing pair the dual-theme sweep introduces clears its AA floor in
// BOTH themes (design-system.md §1.1/§1.6, plan Interfaces "AA pairs").

/** Hex values for exactly the tokens this sweep's `dark:`/light pairs use. */
const HEX = {
  // Light (pre-existing brand scale, design-system.md §1.1)
  ink900: "#123a30",
  brand700: "#1f6350",
  page50: "#f2f8f6",
  cardWhite: "#ffffff",
  accentWarm: "#FF7A59",
  // Dark ink used specifically on the coral/accent-warm chip fill (design
  // decision: "coral chips use dark ink" -- coincidentally the same hex as
  // the dark theme's `surface.raised-dark` token, but this pairing is a
  // LIGHT-theme decorative-chip choice, unrelated to dark mode).
  darkInkOnCoral: "#143026",
  // Dark (new semantic tokens, tailwind-preset.mjs)
  inkDark: "#E7E0D3",
  inkMutedDark: "#9AA8A1",
  pageDark: "#0c140f",
  cardDark: "#16241F",
  raisedDark: "#143026",
  accentDark: "#1E6B54",
  accentBright: "#2EA57C",
  white: "#ffffff",
  // Error text: the plan's Interfaces section asserted `text-red-700`
  // (#b91c1c) clears >=4.5:1 on `card-dark` "verify dark contrast in the
  // contrast test" -- the actual WCAG math below shows red-700 measures
  // ~2.5:1 on every dark surface (fails even the 3:1 UI floor), so
  // `text-field.tsx`'s error text uses `dark:text-red-400` instead (a
  // corrected, AA-passing dark-mode error color; the light-mode
  // `text-red-700` stays byte-identical per design-system.md §1.1).
  red700: "#b91c1c",
  red400: "#f87171",
} as const;

/** WCAG 2.2 relative-luminance formula (w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). */
function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const [r, g, b] = linear as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

const NORMAL_TEXT_FLOOR = 4.5;
const UI_LARGE_TEXT_FLOOR = 3.0;

describe("dual-theme-contrast: LIGHT theme pairs clear their AA floor", () => {
  it.each([
    ["ink-900 on page-50", HEX.ink900, HEX.page50, NORMAL_TEXT_FLOOR],
    ["ink-900 on white card", HEX.ink900, HEX.cardWhite, NORMAL_TEXT_FLOOR],
    ["ink-muted (brand-700) on white card", HEX.brand700, HEX.cardWhite, NORMAL_TEXT_FLOOR],
    ["ink-muted (brand-700) on page-50", HEX.brand700, HEX.page50, NORMAL_TEXT_FLOOR],
    ["white on accent (brand-700) fill", HEX.white, HEX.brand700, NORMAL_TEXT_FLOOR],
    ["dark ink on accent-warm coral chip", HEX.darkInkOnCoral, HEX.accentWarm, NORMAL_TEXT_FLOOR],
  ])("%s is >= its floor", (_name, fg, bg, floor) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(floor);
  });
});

describe("dual-theme-contrast: DARK theme pairs clear their AA floor", () => {
  it.each([
    ["ink-dark on page-dark", HEX.inkDark, HEX.pageDark, NORMAL_TEXT_FLOOR],
    ["ink-dark on card-dark", HEX.inkDark, HEX.cardDark, NORMAL_TEXT_FLOOR],
    ["ink-dark on raised-dark", HEX.inkDark, HEX.raisedDark, NORMAL_TEXT_FLOOR],
    ["ink-muted-dark on card-dark", HEX.inkMutedDark, HEX.cardDark, NORMAL_TEXT_FLOOR],
    ["ink-muted-dark on page-dark", HEX.inkMutedDark, HEX.pageDark, NORMAL_TEXT_FLOOR],
    ["white on accent-dark fill", HEX.white, HEX.accentDark, NORMAL_TEXT_FLOOR],
    ["accent-bright label/border on card-dark (UI floor)", HEX.accentBright, HEX.cardDark, UI_LARGE_TEXT_FLOOR],
    ["red-400 error text on card-dark (corrected dark error color)", HEX.red400, HEX.cardDark, NORMAL_TEXT_FLOOR],
    ["red-400 error text on page-dark", HEX.red400, HEX.pageDark, NORMAL_TEXT_FLOOR],
    ["red-400 error text on raised-dark", HEX.red400, HEX.raisedDark, NORMAL_TEXT_FLOOR],
  ])("%s is >= its floor", (_name, fg, bg, floor) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(floor);
  });

  it("mutation-proof: red-700 (the plan's originally-assumed dark error color) FAILS every dark surface", () => {
    expect(contrastRatio(HEX.red700, HEX.cardDark)).toBeLessThan(NORMAL_TEXT_FLOOR);
    expect(contrastRatio(HEX.red700, HEX.pageDark)).toBeLessThan(NORMAL_TEXT_FLOOR);
    expect(contrastRatio(HEX.red700, HEX.raisedDark)).toBeLessThan(NORMAL_TEXT_FLOOR);
  });
});
