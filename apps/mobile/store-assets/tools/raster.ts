/**
 * T100 plan step 4 -- a tiny, deterministic, dependency-free rasterizer
 * (D1/D2). Draws a rounded-rect (or transparent) background plus a
 * procedural paw mark (one pad ellipse + four toe ellipses), 3x3
 * supersampled for anti-aliasing. No font rasteriser, no third-party
 * artwork -- same input always produces byte-identical output (no `Date`,
 * no randomness), which `store-assets-art.test.ts` asserts directly.
 *
 * Palette values are copied from `packages/config/tailwind-preset.mjs`
 * (`brand.700`, `surface.page-dark`, `surface.page`, `ink.dark`,
 * `brand.500`, `brand.900` -- see F9 of the T100 plan); the art spec
 * cross-checks these literals against that file so the palette cannot drift.
 */

export const BRAND_PALETTE = {
  field: "#1f6350",
  fieldDark: "#0c140f",
  mark: "#F4EFE6",
  markDark: "#E7E0D3",
  accent: "#2f8f74",
  ink: "#123a30",
} as const;

export interface MarkSpec {
  readonly width: number;
  readonly height: number;
  /** Hex fill for the canvas, or `null` for a fully transparent background. */
  readonly background: string | null;
  /** Hex for the paw mark. */
  readonly mark: string;
  /** Fraction (0-1] of the canvas's shorter side the mark occupies. */
  readonly markScale: number;
  /** Corner-radius ratio (relative to the shorter side) applied when `background` is set. 0 = square. */
  readonly cornerRadiusRatio: number;
}

interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

function hexToRgb(hex: string): Rgb {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (match === null) {
    throw new Error(`raster: expected a 6-digit hex colour, got "${hex}"`);
  }
  const value = match[1]!;
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

interface Ellipse {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
}

// Unit-square (0-1) paw geometry (T100 plan step 4's suggested coordinates).
const PAD: Ellipse = { cx: 0.5, cy: 0.62, rx: 0.26, ry: 0.22 };
const TOES: readonly Ellipse[] = [
  { cx: 0.24, cy: 0.36, rx: 0.105, ry: 0.135 },
  { cx: 0.41, cy: 0.25, rx: 0.105, ry: 0.135 },
  { cx: 0.59, cy: 0.25, rx: 0.105, ry: 0.135 },
  { cx: 0.76, cy: 0.36, rx: 0.105, ry: 0.135 },
];

function insideEllipse(x: number, y: number, ellipse: Ellipse, originX: number, originY: number, scale: number): boolean {
  const cx = originX + ellipse.cx * scale;
  const cy = originY + ellipse.cy * scale;
  const rx = ellipse.rx * scale;
  const ry = ellipse.ry * scale;
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  return nx * nx + ny * ny <= 1;
}

function insideMark(x: number, y: number, originX: number, originY: number, scale: number): boolean {
  if (insideEllipse(x, y, PAD, originX, originY, scale)) {
    return true;
  }
  return TOES.some((toe) => insideEllipse(x, y, toe, originX, originY, scale));
}

function insideRoundedRect(x: number, y: number, width: number, height: number, radius: number): boolean {
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return false;
  }
  if (radius <= 0) {
    return true;
  }
  const nearestX = x < radius ? radius : x > width - radius ? width - radius : x;
  const nearestY = y < radius ? radius : y > height - radius ? height - radius : y;
  // Only the four corner regions need the circular test; edges/centre are always inside.
  const inCornerBand = (x < radius || x > width - radius) && (y < radius || y > height - radius);
  if (!inCornerBand) {
    return true;
  }
  const dx = x - nearestX;
  const dy = y - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}

const SUPERSAMPLE_OFFSETS: readonly number[] = [1 / 6, 3 / 6, 5 / 6];

/** Renders a `MarkSpec` to a full RGBA (8 bits/channel) buffer -- pure, deterministic, no I/O. */
export function renderMark(spec: MarkSpec): Uint8Array {
  const { width, height, markScale, cornerRadiusRatio } = spec;
  const markColour = hexToRgb(spec.mark);
  const backgroundColour = spec.background === null ? null : hexToRgb(spec.background);
  const shorterSide = Math.min(width, height);
  const markSize = markScale * shorterSide;
  const originX = (width - markSize) / 2;
  const originY = (height - markSize) / 2;
  const cornerRadius = cornerRadiusRatio * shorterSide;

  const rgba = new Uint8Array(width * height * 4);
  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      let markCount = 0;
      let bgCount = 0;
      for (const dy of SUPERSAMPLE_OFFSETS) {
        for (const dx of SUPERSAMPLE_OFFSETS) {
          const sx = px + dx;
          const sy = py + dy;
          if (insideMark(sx, sy, originX, originY, markSize)) {
            markCount += 1;
          } else if (backgroundColour !== null && insideRoundedRect(sx, sy, width, height, cornerRadius)) {
            bgCount += 1;
          }
        }
      }
      const totalSamples = SUPERSAMPLE_OFFSETS.length * SUPERSAMPLE_OFFSETS.length;
      const covered = markCount + bgCount;
      const index = (py * width + px) * 4;
      if (covered === 0) {
        rgba[index] = 0;
        rgba[index + 1] = 0;
        rgba[index + 2] = 0;
        rgba[index + 3] = 0;
        continue;
      }
      const bg = backgroundColour ?? { r: 0, g: 0, b: 0 };
      rgba[index] = Math.round((markColour.r * markCount + bg.r * bgCount) / covered);
      rgba[index + 1] = Math.round((markColour.g * markCount + bg.g * bgCount) / covered);
      rgba[index + 2] = Math.round((markColour.b * markCount + bg.b * bgCount) / covered);
      rgba[index + 3] = Math.round((255 * covered) / totalSamples);
    }
  }
  return rgba;
}
