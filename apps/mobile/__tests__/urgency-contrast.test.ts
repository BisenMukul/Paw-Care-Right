import { URGENCY_TIERS, type Urgency } from "@pawcareright/types";

import { URGENCY_DISPLAY } from "../src/checks/urgency-display";

// SWEEP-3 plan step 2 / Risk R3 (PRIMARY, SAFETY): the design system defines
// NO AA-verified urgency palette (design-system.md §1.1 blesses only brand +
// red-600/700). This is the load-bearing evidence that every urgency-color
// pair meets its WCAG 2.2 AA floor: the result-screen banner (large,
// `font-bold` text) needs >=3:1; the history-row chip (12px small text)
// needs >=4.5:1. Self-contained on purpose: a local hex-per-class map + a
// local relative-luminance function, independent of any third-party
// contrast lib, so this evidence can't silently drift with a dependency
// bump.

/** Tailwind v3 default-palette hexes for exactly the classes this app's
 * urgency map uses (verified against `tailwindcss/colors.js`) + `white`. */
const HEX_BY_CLASS: Record<string, string> = {
  "text-white": "#ffffff",
  "bg-red-600": "#dc2626",
  "bg-red-100": "#fee2e2",
  "text-red-900": "#7f1d1d",
  "bg-orange-600": "#ea580c",
  "bg-orange-100": "#ffedd5",
  "text-orange-900": "#7c2d12",
  "bg-amber-400": "#fbbf24",
  "bg-amber-100": "#fef3c7",
  "text-amber-950": "#451a03",
  "bg-blue-500": "#3b82f6",
  "bg-blue-100": "#dbeafe",
  "text-blue-900": "#1e3a8a",
  "bg-green-600": "#16a34a",
  "bg-green-100": "#dcfce7",
  "text-green-900": "#14532d",
  // The pre-fix fill, kept here only so the mutation-proof test below can
  // assert it fails the floor -- never referenced by urgency-display.ts.
  "bg-orange-500": "#f97316",
  // PAWSAATHI-3 plan (decision 4): dark chip pairs -- history-row tier
  // chips only, deep-fill/light-text same-hue pairs, per §1.1a/§1.6.
  "bg-red-900": "#7f1d1d",
  "text-red-100": "#fee2e2",
  "bg-orange-900": "#7c2d12",
  "text-orange-100": "#ffedd5",
  "bg-amber-900": "#78350f",
  "text-amber-100": "#fef3c7",
  "bg-blue-900": "#1e3a8a",
  "text-blue-100": "#dbeafe",
  "bg-green-900": "#14532d",
  "text-green-100": "#dcfce7",
};

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

function classToHex(className: string): string {
  const hex = HEX_BY_CLASS[className];
  if (hex === undefined) {
    throw new Error(`urgency-contrast.test.ts: no hex mapping for "${className}" -- add one before trusting this test`);
  }
  return hex;
}

/** PAWSAATHI-3: `chipContainerClass`/`chipTextClass` are now compound
 * strings ("bg-red-100 dark:bg-red-900") since the plan appends the dark
 * pair alongside the existing light class. This pulls the light-mode-only
 * FIRST token back out so the pre-existing light-pair assertion below keeps
 * verifying exactly what it always verified. */
function lightToken(className: string): string {
  return className.split(" ")[0]!;
}

const BANNER_LARGE_TEXT_FLOOR = 3;
const CHIP_SMALL_TEXT_FLOOR = 4.5;

describe("urgency-contrast: banner fills clear the 3:1 large-text floor", () => {
  it.each(URGENCY_TIERS)("%s banner fill/text pair is >= 3:1", (tier) => {
    const display = URGENCY_DISPLAY[tier];
    const ratio = contrastRatio(classToHex(display.containerClass), classToHex(display.textClass));

    expect(ratio).toBeGreaterThanOrEqual(BANNER_LARGE_TEXT_FLOOR);
  });

  it("VET_24H banner ratio is the computed 3.56:1 (bg-orange-600 fix)", () => {
    const display = URGENCY_DISPLAY.VET_24H;

    expect(display.containerClass).toBe("bg-orange-600");
    const ratio = contrastRatio(classToHex(display.containerClass), classToHex(display.textClass));
    expect(ratio).toBeCloseTo(3.56, 1);
  });

  it("mutation-proof: the pre-fix bg-orange-500 fill fails the 3:1 floor", () => {
    const ratio = contrastRatio(classToHex("bg-orange-500"), classToHex("text-white"));

    expect(ratio).toBeLessThan(BANNER_LARGE_TEXT_FLOOR);
  });
});

describe("urgency-contrast: history-chip fills clear the 4.5:1 small-text floor", () => {
  it.each(URGENCY_TIERS)("%s chip fill/text pair is >= 4.5:1", (tier) => {
    const display = URGENCY_DISPLAY[tier];
    const ratio = contrastRatio(
      classToHex(lightToken(display.chipContainerClass)),
      classToHex(lightToken(display.chipTextClass)),
    );

    expect(ratio).toBeGreaterThanOrEqual(CHIP_SMALL_TEXT_FLOOR);
  });
});

// PAWSAATHI-3 plan (decision 4 / "AA math FIRST"): the ONLY new dark pairs
// this batch introduces -- one deep-fill/light-text same-hue dark pair per
// tier, for the history-row chip only (the banner pairs stay byte-identical,
// decision 3). Verified here BEFORE `urgency-display.ts` is wired to them.
const DARK_CHIP_CLASSES_BY_TIER: Record<Urgency, { container: string; text: string }> = {
  EMERGENCY_NOW: { container: "bg-red-900", text: "text-red-100" },
  VET_24H: { container: "bg-orange-900", text: "text-orange-100" },
  VET_SOON: { container: "bg-amber-900", text: "text-amber-100" },
  MONITOR: { container: "bg-blue-900", text: "text-blue-100" },
  REASSURE: { container: "bg-green-900", text: "text-green-100" },
};

describe("dark chip pairs clear the 4.5:1 small-text floor", () => {
  it.each(URGENCY_TIERS)("%s dark chip fill/text pair is >= 4.5:1", (tier) => {
    const pair = DARK_CHIP_CLASSES_BY_TIER[tier];
    const ratio = contrastRatio(classToHex(pair.container), classToHex(pair.text));

    expect(ratio).toBeGreaterThanOrEqual(CHIP_SMALL_TEXT_FLOOR);
  });

  it("mutation-proof: same-hue dark-on-dark (text-red-900 on bg-red-900) fails the 4.5:1 floor", () => {
    const ratio = contrastRatio(classToHex("bg-red-900"), classToHex("text-red-900"));

    expect(ratio).toBeLessThan(CHIP_SMALL_TEXT_FLOOR);
  });
});
