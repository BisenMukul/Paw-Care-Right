/**
 * T100 plan step 2 -- a minimal, deterministic PNG encoder (D1: zero new
 * dependencies; `sharp` stays `apps/api`-only). Supports exactly what this
 * kit needs: 8-bit depth, non-interlaced, colour type 2 (truecolor, no
 * alpha) or 6 (truecolor + alpha), one IDAT chunk, filter type `None` on
 * every row. `png-decode.ts` is the independent reader that round-trips
 * this output (`store-assets-codec.test.ts`).
 */

interface NodeZlib {
  deflateSync(data: Uint8Array, options?: { level?: number }): Uint8Array;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: locally-typed require avoids adding @types/node (a new dep is out of scope), mirrors scripts/analyze-bundle.ts
const zlib = require("node:zlib") as NodeZlib;

export const PNG_SIGNATURE: readonly number[] = [137, 80, 78, 71, 13, 10, 26, 10];

function writeUint32BE(value: number): Uint8Array {
  return new Uint8Array([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
}

function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function makeCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = makeCrcTable();

/** Standard PNG CRC-32 (used on every chunk's type+data). */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    const tableIndex = (crc ^ bytes[i]!) & 0xff;
    crc = CRC_TABLE[tableIndex]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new Uint8Array(type.length);
  for (let i = 0; i < type.length; i += 1) {
    typeBytes[i] = type.charCodeAt(i);
  }
  const crc = crc32(concatBytes([typeBytes, data]));
  return concatBytes([writeUint32BE(data.length), typeBytes, data, writeUint32BE(crc)]);
}

function buildIhdr(width: number, height: number, colourType: number): Uint8Array {
  // bit depth 8, compression 0, filter method 0, interlace 0 (fixed, per D1 scope).
  return concatBytes([writeUint32BE(width), writeUint32BE(height), new Uint8Array([8, colourType, 0, 0, 0])]);
}

/** Prefixes every scanline with filter-type byte `0` (None) -- simplest correct encoder (risk-log D1). */
function buildRawScanlines(rgba: Uint8Array, width: number, height: number, alpha: boolean): Uint8Array {
  const bytesPerPixel = alpha ? 4 : 3;
  const rowBytes = width * bytesPerPixel;
  const raw = new Uint8Array((rowBytes + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (rowBytes + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x += 1) {
      const srcIndex = (y * width + x) * 4;
      const dstIndex = rowStart + 1 + x * bytesPerPixel;
      raw[dstIndex] = rgba[srcIndex]!;
      raw[dstIndex + 1] = rgba[srcIndex + 1]!;
      raw[dstIndex + 2] = rgba[srcIndex + 2]!;
      if (alpha) {
        raw[dstIndex + 3] = rgba[srcIndex + 3]!;
      }
    }
  }
  return raw;
}

/**
 * Encodes a full RGBA (8 bits/channel) buffer as a PNG. `opts.alpha` selects
 * colour type 6 (keep the alpha channel) vs colour type 2 (drop it --
 * callers must only pass `alpha: false` for buffers that are fully opaque,
 * see `asset-manifest.ts`'s `render.background` contract).
 */
export function encodePng(rgba: Uint8Array, width: number, height: number, opts: { readonly alpha: boolean }): Uint8Array {
  if (rgba.length !== width * height * 4) {
    throw new Error(`encodePng: expected an RGBA buffer of ${width * height * 4} bytes, got ${rgba.length}`);
  }
  const colourType = opts.alpha ? 6 : 2;
  const ihdr = buildChunk("IHDR", buildIhdr(width, height, colourType));
  const raw = buildRawScanlines(rgba, width, height, opts.alpha);
  const compressed = zlib.deflateSync(raw, { level: 9 });
  const idat = buildChunk("IDAT", compressed);
  const iend = buildChunk("IEND", new Uint8Array(0));
  return concatBytes([new Uint8Array(PNG_SIGNATURE), ihdr, idat, iend]);
}
