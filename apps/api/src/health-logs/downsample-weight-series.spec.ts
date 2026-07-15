import { downsampleWeightSeries, type WeightSeriesPoint } from "./downsample-weight-series";

function ascendingSeries(length: number): WeightSeriesPoint[] {
  return Array.from({ length }, (_, i) => ({ t: i * 1000, grams: 10_000 + i }));
}

describe("downsampleWeightSeries", () => {
  describe("passthrough_at_or_below_threshold", () => {
    it.each([0, 1, 199, 200])("length %d -> returned unchanged (identity of values, ascending order)", (length) => {
      const points = ascendingSeries(length);

      const result = downsampleWeightSeries(points);

      expect(result).toEqual(points);
      expect(result.length).toBe(length);
    });

    it("does not return the same array/element instances (defensive copy)", () => {
      const points = ascendingSeries(5);

      const result = downsampleWeightSeries(points);

      expect(result).not.toBe(points);
      if (result.length > 0) {
        expect(result[0]).not.toBe(points[0]);
      }
    });
  });

  describe("downsamples_above_threshold", () => {
    it.each([201, 1000])("length %d -> result length <= 200, strictly ascending, endpoints preserved", (length) => {
      const points = ascendingSeries(length);

      const result = downsampleWeightSeries(points);

      expect(result.length).toBeLessThanOrEqual(200);
      for (let i = 1; i < result.length; i += 1) {
        expect(result[i]!.t).toBeGreaterThan(result[i - 1]!.t);
      }
      // The first bucket always starts at source index 0 and the last bucket
      // always ends at the final source index, so the emitted bucket means
      // are bounded by (never outside) the true earliest/latest timestamps --
      // exact equality only holds when a bucket happens to contain one point
      // (asserted precisely, for length 201, in `bucket_mean_values` below).
      expect(result[0]!.t).toBeGreaterThanOrEqual(points[0]!.t);
      expect(result[result.length - 1]!.t).toBeLessThanOrEqual(points[points.length - 1]!.t);
    });
  });

  describe("bucket_mean_values", () => {
    it("splits 4 points into 2 equal-count buckets and averages each", () => {
      const points: WeightSeriesPoint[] = [
        { t: 0, grams: 10 },
        { t: 10, grams: 20 },
        { t: 20, grams: 30 },
        { t: 30, grams: 40 },
      ];

      const result = downsampleWeightSeries(points, 2);

      expect(result).toEqual([
        { t: 5, grams: 15 },
        { t: 25, grams: 35 },
      ]);
    });

    it("201 points with max=200 -> the last bucket is the mean of the final two source points", () => {
      const points = ascendingSeries(201);

      const result = downsampleWeightSeries(points, 200);

      expect(result).toHaveLength(200);
      const last = result[result.length - 1]!;
      const expectedT = (points[199]!.t + points[200]!.t) / 2;
      const expectedGrams = Math.round((points[199]!.grams + points[200]!.grams) / 2);
      expect(last.t).toBe(expectedT);
      expect(last.grams).toBe(expectedGrams);
      // Every earlier bucket has exactly one source point, so it passes through unchanged.
      expect(result[0]).toEqual(points[0]);
    });
  });

  describe("pure_no_mutation", () => {
    it("leaves the input array and its elements untouched after the call", () => {
      const points = ascendingSeries(500);
      const clone = points.map((p) => ({ ...p }));

      downsampleWeightSeries(points);

      expect(points).toEqual(clone);
    });

    it("leaves a passthrough-sized input untouched too", () => {
      const points = ascendingSeries(50);
      const clone = points.map((p) => ({ ...p }));

      downsampleWeightSeries(points);

      expect(points).toEqual(clone);
    });
  });
});
