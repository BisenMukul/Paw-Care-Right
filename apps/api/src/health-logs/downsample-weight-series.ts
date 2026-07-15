/**
 * `downsampleWeightSeries` (T064 plan decision D6). Pure, side-effect-free,
 * deterministic uniform contiguous-bucket-mean downsampling for the
 * `GET /pets/:petId/weight-series` line chart.
 *
 * `points` MUST already be time-ascending. If `points.length <= max` the
 * series is returned unchanged (a defensive copy, never the same array/
 * element references); otherwise it is split into exactly `max` contiguous,
 * non-overlapping, roughly-equal-count buckets (standard `floor(i*n/max)`
 * boundary assignment -- monotonic and gapless whenever `n >= max`, which
 * this branch always satisfies) and each bucket collapses to one point:
 * `{ t: mean(t), grams: round(mean(grams)) }`.
 */

export interface WeightSeriesPoint {
  /** Epoch milliseconds. */
  t: number;
  grams: number;
}

export const WEIGHT_SERIES_DOWNSAMPLE_MAX = 200;

export function downsampleWeightSeries(
  points: readonly WeightSeriesPoint[],
  max: number = WEIGHT_SERIES_DOWNSAMPLE_MAX,
): WeightSeriesPoint[] {
  if (points.length <= max) {
    return points.map((point) => ({ t: point.t, grams: point.grams }));
  }

  const result: WeightSeriesPoint[] = [];
  for (let bucketIndex = 0; bucketIndex < max; bucketIndex += 1) {
    const start = Math.floor((bucketIndex * points.length) / max);
    const end = Math.floor(((bucketIndex + 1) * points.length) / max);
    const bucket = points.slice(start, end);
    if (bucket.length === 0) {
      continue;
    }

    const tSum = bucket.reduce((sum, point) => sum + point.t, 0);
    const gramsSum = bucket.reduce((sum, point) => sum + point.grams, 0);
    result.push({ t: tSum / bucket.length, grams: Math.round(gramsSum / bucket.length) });
  }

  return result;
}
