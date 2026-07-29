/**
 * T100 plan step 13 (§6 AC1-a) -- proves the hand-rolled PNG codec
 * (`png-encode.ts`/`png-decode.ts`, D1: zero new dependencies) is correct on
 * its own terms: round-trips both supported colour types, exposes the
 * declared IHDR fields, and rejects every unsupported case loudly. All
 * pixel data here is synthesized in-memory -- no committed binary fixture.
 */
import { encodePng } from "../store-assets/tools/png-encode";
import { decodePng, readPngHeader } from "../store-assets/tools/png-decode";

function makeGradientRgba(width: number, height: number, withAlpha: boolean): Uint8Array {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      rgba[i] = (x * 7) % 256;
      rgba[i + 1] = (y * 13) % 256;
      rgba[i + 2] = (x + y) % 256;
      rgba[i + 3] = withAlpha ? (x * y) % 256 : 255;
    }
  }
  return rgba;
}

describe("store-assets PNG codec", () => {
  it("round-trips an RGBA canvas through encode -> decode", () => {
    const width = 17;
    const height = 11;
    const rgba = makeGradientRgba(width, height, true);
    const png = encodePng(rgba, width, height, { alpha: true });
    const decoded = decodePng(png);
    expect(decoded.width).toBe(width);
    expect(decoded.height).toBe(height);
    expect(Array.from(decoded.rgba)).toEqual(Array.from(rgba));
  });

  it("round-trips an opaque RGB canvas", () => {
    const width = 9;
    const height = 23;
    const rgba = makeGradientRgba(width, height, false);
    const png = encodePng(rgba, width, height, { alpha: false });
    const decoded = decodePng(png);
    expect(decoded.width).toBe(width);
    expect(decoded.height).toBe(height);
    // Colour type 2 has no alpha channel -- every decoded pixel reports alpha 255.
    for (let i = 3; i < decoded.rgba.length; i += 4) {
      expect(decoded.rgba[i]).toBe(255);
    }
    expect(Array.from(decoded.rgba)).toEqual(Array.from(rgba));
  });

  it("writes the declared IHDR fields", () => {
    const rgba = makeGradientRgba(5, 6, true);
    const rgbaPng = encodePng(rgba, 5, 6, { alpha: true });
    expect(readPngHeader(rgbaPng)).toEqual({ width: 5, height: 6, bitDepth: 8, colourType: 6, interlace: 0 });

    const rgb = makeGradientRgba(5, 6, false);
    const rgbPng = encodePng(rgb, 5, 6, { alpha: false });
    expect(readPngHeader(rgbPng)).toEqual({ width: 5, height: 6, bitDepth: 8, colourType: 2, interlace: 0 });
  });

  it("rejects unsupported bit depth / colour type / interlace with a named error", () => {
    const base = encodePng(makeGradientRgba(4, 4, true), 4, 4, { alpha: true });

    const badBitDepth = Uint8Array.from(base);
    badBitDepth[24] = 16;
    expect(() => decodePng(badBitDepth)).toThrow(/bit depth/);

    const badColourType = Uint8Array.from(base);
    badColourType[25] = 3;
    expect(() => decodePng(badColourType)).toThrow(/colour type/);

    const badInterlace = Uint8Array.from(base);
    badInterlace[28] = 1;
    expect(() => decodePng(badInterlace)).toThrow(/interlace/);
  });

  it("rejects a mismatched RGBA buffer length at encode time", () => {
    expect(() => encodePng(new Uint8Array(10), 4, 4, { alpha: true })).toThrow(/expected an RGBA buffer/);
  });

  it("rejects a non-PNG signature at decode time", () => {
    expect(() => decodePng(new Uint8Array(32))).toThrow(/signature/);
  });
});
