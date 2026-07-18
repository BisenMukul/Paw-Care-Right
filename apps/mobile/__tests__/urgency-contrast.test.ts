import { URGENCY_TIERS } from "@pawcareright/types";

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
    const ratio = contrastRatio(classToHex(display.chipContainerClass), classToHex(display.chipTextClass));

    expect(ratio).toBeGreaterThanOrEqual(CHIP_SMALL_TEXT_FLOOR);
  });
});
