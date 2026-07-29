/**
 * T100 plan step 10 -- the screenshot compositor. `composeShot` renders one
 * device-framed, captioned-band canvas (brand background + caption band +
 * a programmatically-drawn device frame with the real capture bilinear
 * scaled to fit) from a decoded capture PNG. `composeShotSet` drives it
 * across every profile x shot combination, writing the framed PNG plus a
 * caption `.txt` sidecar and a combined `copy-blocks.md`.
 *
 * Kept "pure" (D-labelled in the plan): no `node:fs`/`node:path` import
 * here -- the caller (`compose-screenshots.ts`) injects a small `fs`
 * interface, so this module has no I/O of its own and is directly
 * unit-testable with in-memory doubles or a real `mkdtempSync` temp dir.
 *
 * Caption TEXT is never burned into pixels (plan D3 -- no font
 * rasteriser/new dependency); the caption band is a flat colour reserving
 * the right proportion of the canvas, and the real headline/subhead ship
 * as the `.txt` sidecar + `copy-blocks.md` instead.
 */
import { BRAND_PALETTE } from "./raster";
import type { DeviceProfile, Shot } from "./screenshot-profiles";

export interface DecodedCapture {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
}

export interface ShotCopy {
  readonly headline: string;
  readonly subhead: string;
}

export interface MarketingBlocks {
  readonly en: {
    readonly shots: Readonly<Record<string, ShotCopy>>;
    readonly disclosure: string;
  };
}

export interface ComposeFs {
  readonly existsSync: (path: string) => boolean;
  readonly readFileSync: (path: string) => Uint8Array;
  readonly writeFileSync: (path: string, data: Uint8Array | string) => void;
  readonly mkdirSync: (path: string, options: { readonly recursive: boolean }) => void;
}

const CAPTION_BAND_RATIO = 0.22;

interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

function hexToRgb(hex: string): Rgb {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (match === null) {
    throw new Error(`compose: expected a 6-digit hex colour, got "${hex}"`);
  }
  const value = match[1]!;
  return { r: parseInt(value.slice(0, 2), 16), g: parseInt(value.slice(2, 4), 16), b: parseInt(value.slice(4, 6), 16) };
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function insideRoundedCorner(x: number, y: number, width: number, height: number, radius: number): boolean {
  if (radius <= 0) {
    return true;
  }
  const nearestX = x < radius ? radius : x > width - radius ? width - radius : x;
  const nearestY = y < radius ? radius : y > height - radius ? height - radius : y;
  const inCornerBand = (x < radius || x > width - radius) && (y < radius || y > height - radius);
  if (!inCornerBand) {
    return true;
  }
  const dx = x - nearestX;
  const dy = y - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}

function setPixel(rgba: Uint8Array, width: number, x: number, y: number, colour: Rgb): void {
  const index = (y * width + x) * 4;
  rgba[index] = colour.r;
  rgba[index + 1] = colour.g;
  rgba[index + 2] = colour.b;
  rgba[index + 3] = 255;
}

/** Bilinear-samples `capture` at fractional source coordinates. */
function sampleBilinear(capture: DecodedCapture, sx: number, sy: number): Rgb {
  const x0 = Math.max(0, Math.min(capture.width - 1, Math.floor(sx)));
  const y0 = Math.max(0, Math.min(capture.height - 1, Math.floor(sy)));
  const x1 = Math.min(capture.width - 1, x0 + 1);
  const y1 = Math.min(capture.height - 1, y0 + 1);
  const fx = sx - x0;
  const fy = sy - y0;
  const at = (x: number, y: number): Rgb => {
    const i = (y * capture.width + x) * 4;
    return { r: capture.rgba[i]!, g: capture.rgba[i + 1]!, b: capture.rgba[i + 2]! };
  };
  const c00 = at(x0, y0);
  const c10 = at(x1, y0);
  const c01 = at(x0, y1);
  const c11 = at(x1, y1);
  const top = { r: lerp(c00.r, c10.r, fx), g: lerp(c00.g, c10.g, fx), b: lerp(c00.b, c10.b, fx) };
  const bottom = { r: lerp(c01.r, c11.r, fx), g: lerp(c01.g, c11.g, fx), b: lerp(c01.b, c11.b, fx) };
  return { r: lerp(top.r, bottom.r, fy), g: lerp(top.g, bottom.g, fy), b: lerp(top.b, bottom.b, fy) };
}

export interface ComposeShotArgs {
  readonly capture: DecodedCapture;
  readonly profile: DeviceProfile;
  readonly caption: ShotCopy;
}

/** Renders one profile x shot canvas. Pure, deterministic, no I/O. */
export function composeShot({ capture, profile, caption }: ComposeShotArgs): { width: number; height: number; rgba: Uint8Array } {
  if (caption.headline.length === 0 || caption.subhead.length === 0) {
    throw new Error("composeShot: caption must have a non-empty headline and subhead");
  }
  const { width, height } = profile;
  const field = hexToRgb(BRAND_PALETTE.field);
  const fieldDark = hexToRgb(BRAND_PALETTE.fieldDark);
  const rgba = new Uint8Array(width * height * 4);

  // 1. Vertical two-stop background.
  for (let y = 0; y < height; y += 1) {
    const t = height <= 1 ? 0 : y / (height - 1);
    const colour = { r: lerp(field.r, fieldDark.r, t), g: lerp(field.g, fieldDark.g, t), b: lerp(field.b, fieldDark.b, t) };
    for (let x = 0; x < width; x += 1) {
      setPixel(rgba, width, x, y, colour);
    }
  }

  // 2. Caption band (flat brand field, top of canvas).
  const bandHeight = Math.round(height * CAPTION_BAND_RATIO);
  for (let y = 0; y < bandHeight; y += 1) {
    for (let x = 0; x < width; x += 1) {
      setPixel(rgba, width, x, y, field);
    }
  }

  // 3. Device frame (rounded-rect bezel) below the caption band.
  const margin = Math.round(width * profile.bezelRatio * 2);
  const frameTop = bandHeight + margin;
  const frameLeft = margin;
  const frameRight = width - margin;
  const frameBottom = height - margin;
  const frameWidth = frameRight - frameLeft;
  const frameHeight = frameBottom - frameTop;
  const frameRadius = Math.round(Math.min(width, height) * profile.frameRadiusRatio);
  const bezelThickness = Math.round(width * profile.bezelRatio);
  const bezelColour = hexToRgb(BRAND_PALETTE.ink);

  for (let y = frameTop; y < frameBottom; y += 1) {
    for (let x = frameLeft; x < frameRight; x += 1) {
      if (insideRoundedCorner(x - frameLeft, y - frameTop, frameWidth, frameHeight, frameRadius)) {
        setPixel(rgba, width, x, y, bezelColour);
      }
    }
  }

  // 4. Interior screen area (inset by the bezel thickness) -- the capture is
  // bilinear-scaled to CONTAIN within it, centred, never distorted.
  const interiorLeft = frameLeft + bezelThickness;
  const interiorTop = frameTop + bezelThickness;
  const interiorWidth = frameWidth - bezelThickness * 2;
  const interiorHeight = frameHeight - bezelThickness * 2;
  const scale = Math.min(interiorWidth / capture.width, interiorHeight / capture.height);
  const scaledWidth = capture.width * scale;
  const scaledHeight = capture.height * scale;
  const offsetX = interiorLeft + (interiorWidth - scaledWidth) / 2;
  const offsetY = interiorTop + (interiorHeight - scaledHeight) / 2;

  for (let y = Math.round(offsetY); y < Math.round(offsetY + scaledHeight); y += 1) {
    for (let x = Math.round(offsetX); x < Math.round(offsetX + scaledWidth); x += 1) {
      const sx = ((x - offsetX) / scale) as number;
      const sy = ((y - offsetY) / scale) as number;
      setPixel(rgba, width, x, y, sampleBilinear(capture, sx, sy));
    }
  }

  return { width, height, rgba };
}

export interface ComposeShotSetArgs {
  readonly inputDir: string;
  readonly outputDir: string;
  readonly profiles: readonly DeviceProfile[];
  readonly shots: readonly Shot[];
  readonly marketing: MarketingBlocks;
  readonly fs: ComposeFs;
  readonly decodePng: (bytes: Uint8Array) => DecodedCapture;
  readonly encodePng: (rgba: Uint8Array, width: number, height: number, opts: { readonly alpha: boolean }) => Uint8Array;
  readonly joinPath: (...parts: string[]) => string;
}

function sidecarText(caption: ShotCopy, disclosure: string): string {
  return `${caption.headline}\n${caption.subhead}\n\n${disclosure}\n`;
}

function copyBlocksMarkdown(shots: readonly Shot[], marketing: MarketingBlocks): string {
  const lines = ["| Shot | Headline | Subhead |", "|---|---|---|"];
  for (const shot of shots) {
    const copy = marketing.en.shots[shot.captionKey];
    if (copy === undefined) {
      throw new Error(`compose-screenshots: no marketing copy for captionKey "${shot.captionKey}"`);
    }
    lines.push(`| \`${shot.id}\` | ${copy.headline} | ${copy.subhead} |`);
  }
  lines.push("", marketing.en.disclosure, "");
  return lines.join("\n");
}

/** Drives `composeShot` across every profile x shot combination, writing PNGs + caption sidecars + `copy-blocks.md`. */
export function composeShotSet(args: ComposeShotSetArgs): string[] {
  const { inputDir, outputDir, profiles, shots, marketing, fs, decodePng, encodePng, joinPath } = args;
  const written: string[] = [];

  for (const shot of shots) {
    const inputPath = joinPath(inputDir, `${shot.id}.png`);
    if (!fs.existsSync(inputPath)) {
      throw new Error(`compose-screenshots: missing capture at ${inputPath} (run the /emulator-test capture flow first)`);
    }
    const capture = decodePng(fs.readFileSync(inputPath));
    const caption = marketing.en.shots[shot.captionKey];
    if (caption === undefined) {
      throw new Error(`compose-screenshots: no marketing copy for captionKey "${shot.captionKey}"`);
    }

    for (const profile of profiles) {
      const composed = composeShot({ capture, profile, caption });
      const png = encodePng(composed.rgba, composed.width, composed.height, { alpha: false });
      const profileDir = joinPath(outputDir, profile.id);
      fs.mkdirSync(profileDir, { recursive: true });
      const pngPath = joinPath(profileDir, `${shot.id}.png`);
      fs.writeFileSync(pngPath, png);
      written.push(pngPath);

      const txtPath = joinPath(profileDir, `${shot.id}.txt`);
      fs.writeFileSync(txtPath, sidecarText(caption, marketing.en.disclosure));
      written.push(txtPath);
    }
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const copyBlocksPath = joinPath(outputDir, "copy-blocks.md");
  fs.writeFileSync(copyBlocksPath, copyBlocksMarkdown(shots, marketing));
  written.push(copyBlocksPath);

  return written;
}
