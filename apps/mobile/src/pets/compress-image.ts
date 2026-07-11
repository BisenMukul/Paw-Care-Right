import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/** No enlargement above this long edge; matches CLAUDE.md §6 image rule. */
const MAX_LONG_EDGE = 1600;
const JPEG_QUALITY = 0.7;

export interface CompressImageInput {
  uri: string;
  width: number;
  height: number;
}

export interface CompressImageResult {
  uri: string;
  width: number;
  height: number;
}

/**
 * Thin wrapper localizing the `expo-image-manipulator` API-shape risk (plan
 * R6): SDK 57 exposes only the new, contextual `ImageManipulator.manipulate`
 * API (chainable `.resize()` on an `ImageManipulatorContext`, awaited via
 * `.renderAsync()` to an `ImageRef`, then `.saveAsync()` to persist). There
 * is no legacy `manipulateAsync` export usable here. Resizes the longest
 * edge down to `MAX_LONG_EDGE` (never enlarges) and re-encodes as JPEG at
 * `JPEG_QUALITY`.
 */
export async function compressImage(input: CompressImageInput): Promise<CompressImageResult> {
  const longEdge = Math.max(input.width, input.height);
  let context = ImageManipulator.manipulate(input.uri);

  if (longEdge > MAX_LONG_EDGE) {
    context =
      input.width >= input.height
        ? context.resize({ width: MAX_LONG_EDGE })
        : context.resize({ height: MAX_LONG_EDGE });
  }

  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });

  return { uri: saved.uri, width: saved.width, height: saved.height };
}
