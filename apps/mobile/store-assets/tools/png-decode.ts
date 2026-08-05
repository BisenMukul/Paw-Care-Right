/**
 * T100 plan step 3 -- the independent reader for `png-encode.ts`'s output
 * (D1: zero new dependencies). Supports bit depth 8, colour types 2/6,
 * interlace method 0, and all five PNG row filters (needed to decode this
 * kit's own synthetic screenshot captures in `store-screenshot-kit.test.ts`,
 * which are re-encoded after compositing, not merely re-read). Every
 * unsupported input throws, naming the offending field -- no silent
 * fallback (plan step 3).
 */

interface NodeZlib {
  inflateSync(data: Uint8Array): Uint8Array;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: locally-typed require avoids adding @types/node (a new dep is out of scope), mirrors scripts/analyze-bundle.ts
const zlib = require("node:zlib") as NodeZlib;

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export interface PngHeader {
  readonly width: number;
  readonly height: number;
  readonly bitDepth: number;
  readonly colourType: number;
  readonly interlace: number;
}

export interface DecodedPng {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0;
}

function checkSignature(bytes: Uint8Array): void {
  for (let i = 0; i < SIGNATURE.length; i += 1) {
    if (bytes[i] !== SIGNATURE[i]) {
      throw new Error("decodePng: not a PNG file (bad signature)");
    }
  }
}

/** Cheap IHDR-only read (used by the manifest spec -- no inflate needed). */
export function readPngHeader(bytes: Uint8Array): PngHeader {
  checkSignature(bytes);
  const length = readUint32BE(bytes, 8);
  const type = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);
  if (type !== "IHDR" || length !== 13) {
    throw new Error(`decodePng: expected a leading IHDR chunk, found "${type}"`);
  }
  const dataStart = 16;
  return {
    width: readUint32BE(bytes, dataStart),
    height: readUint32BE(bytes, dataStart + 4),
    bitDepth: bytes[dataStart + 8]!,
    colourType: bytes[dataStart + 9]!,
    interlace: bytes[dataStart + 12]!,
  };
}

function collectIdat(bytes: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [];
  let offset = 8;
  while (offset < bytes.length) {
    const length = readUint32BE(bytes, offset);
    const type = String.fromCharCode(
      bytes[offset + 4]!,
      bytes[offset + 5]!,
      bytes[offset + 6]!,
      bytes[offset + 7]!,
    );
    const dataStart = offset + 8;
    if (type === "IDAT") {
      parts.push(bytes.subarray(dataStart, dataStart + length));
    } else if (type === "IEND") {
      break;
    }
    offset = dataStart + length + 4;
  }
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) {
    return a;
  }
  return pb <= pc ? b : c;
}

function unfilter(raw: Uint8Array, width: number, height: number, bytesPerPixel: number): Uint8Array {
  const rowBytes = width * bytesPerPixel;
  const out = new Uint8Array(rowBytes * height);
  for (let y = 0; y < height; y += 1) {
    const filterType = raw[y * (rowBytes + 1)]!;
    const srcRowStart = y * (rowBytes + 1) + 1;
    const dstRowStart = y * rowBytes;
    for (let x = 0; x < rowBytes; x += 1) {
      const rawByte = raw[srcRowStart + x]!;
      const a = x >= bytesPerPixel ? out[dstRowStart + x - bytesPerPixel]! : 0;
      const b = y > 0 ? out[dstRowStart - rowBytes + x]! : 0;
      const c = y > 0 && x >= bytesPerPixel ? out[dstRowStart - rowBytes + x - bytesPerPixel]! : 0;
      let value: number;
      switch (filterType) {
        case 0:
          value = rawByte;
          break;
        case 1:
          value = rawByte + a;
          break;
        case 2:
          value = rawByte + b;
          break;
        case 3:
          value = rawByte + Math.floor((a + b) / 2);
          break;
        case 4:
          value = rawByte + paethPredictor(a, b, c);
          break;
        default:
          throw new Error(`decodePng: unsupported row filter type ${filterType}`);
      }
      out[dstRowStart + x] = value & 0xff;
    }
  }
  return out;
}

/** Decodes a PNG produced by (or shaped like) `png-encode.ts`'s output into a full RGBA buffer. */
export function decodePng(bytes: Uint8Array): DecodedPng {
  const header = readPngHeader(bytes);
  if (header.bitDepth !== 8) {
    throw new Error(`decodePng: unsupported bit depth ${header.bitDepth} (only 8 is supported)`);
  }
  if (header.colourType !== 2 && header.colourType !== 6) {
    throw new Error(`decodePng: unsupported colour type ${header.colourType} (only 2 and 6 are supported)`);
  }
  if (header.interlace !== 0) {
    throw new Error(`decodePng: unsupported interlace method ${header.interlace} (only 0 is supported)`);
  }

  const bytesPerPixel = header.colourType === 6 ? 4 : 3;
  const idat = collectIdat(bytes);
  const raw = zlib.inflateSync(idat);
  const reconstructed = unfilter(raw, header.width, header.height, bytesPerPixel);

  const rgba = new Uint8Array(header.width * header.height * 4);
  for (let pixel = 0; pixel < header.width * header.height; pixel += 1) {
    const srcIndex = pixel * bytesPerPixel;
    const dstIndex = pixel * 4;
    rgba[dstIndex] = reconstructed[srcIndex]!;
    rgba[dstIndex + 1] = reconstructed[srcIndex + 1]!;
    rgba[dstIndex + 2] = reconstructed[srcIndex + 2]!;
    rgba[dstIndex + 3] = header.colourType === 6 ? reconstructed[srcIndex + 3]! : 255;
  }
  return { width: header.width, height: header.height, rgba };
}
