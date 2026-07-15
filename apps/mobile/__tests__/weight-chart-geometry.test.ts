import { computeWeightChartGeometry } from "../src/weight/weight-chart-geometry";
import type { WeightBand } from "../src/weight/breed-weight-band";

const WIDTH = 320;
const HEIGHT = 200;
const PADDING = 24;

function geo(
  points: Array<{ t: number; grams: number }>,
  band: WeightBand | null = null,
  unit: "kg" | "lb" = "kg",
) {
  return computeWeightChartGeometry({ points, band, unit, width: WIDTH, height: HEIGHT, padding: PADDING });
}

describe("computeWeightChartGeometry — empty", () => {
  it("isEmpty:true with no dots and an empty path", () => {
    const result = geo([]);
    expect(result.isEmpty).toBe(true);
    expect(result.dots).toEqual([]);
    expect(result.linePath).toBe("");
    expect(result.band).toBeNull();
    expect(result.yTicks).toEqual([]);
  });
});

describe("computeWeightChartGeometry — single point", () => {
  it("isEmpty:false, one dot at mid-x, finite y (flat-domain padded)", () => {
    const result = geo([{ t: 1000, grams: 25000 }]);
    expect(result.isEmpty).toBe(false);
    expect(result.dots).toHaveLength(1);
    const dot = result.dots[0];
    expect(dot).toBeDefined();
    expect(dot?.x).toBeCloseTo((PADDING + (WIDTH - PADDING)) / 2);
    expect(Number.isFinite(dot?.y)).toBe(true);
    expect(Number.isNaN(dot?.y)).toBe(false);
    // Flat/single-point domain is padded symmetrically — non-zero span.
    expect(result.yDomain[1] - result.yDomain[0]).toBeGreaterThan(0);
  });
});

describe("computeWeightChartGeometry — flat multi-point domain", () => {
  it("no div-by-zero: finite y for every dot when all grams are equal", () => {
    const result = geo([
      { t: 1000, grams: 25000 },
      { t: 2000, grams: 25000 },
      { t: 3000, grams: 25000 },
    ]);
    expect(result.isEmpty).toBe(false);
    for (const dot of result.dots) {
      expect(Number.isFinite(dot.y)).toBe(true);
    }
    expect(result.yDomain[1] - result.yDomain[0]).toBeGreaterThan(0);
  });
});

describe("computeWeightChartGeometry — many points", () => {
  const points = [
    { t: 1000, grams: 24000 },
    { t: 2000, grams: 24500 },
    { t: 3000, grams: 25000 },
    { t: 4000, grams: 25500 },
    { t: 5000, grams: 26000 },
  ];

  it("dots stay within the plot bounds on both axes", () => {
    const result = geo(points);
    for (const dot of result.dots) {
      expect(dot.x).toBeGreaterThanOrEqual(PADDING);
      expect(dot.x).toBeLessThanOrEqual(WIDTH - PADDING);
      expect(dot.y).toBeGreaterThanOrEqual(PADDING);
      expect(dot.y).toBeLessThanOrEqual(HEIGHT - PADDING);
    }
  });

  it("x is monotonically increasing for ascending t", () => {
    const result = geo(points);
    for (let i = 1; i < result.dots.length; i += 1) {
      const prev = result.dots[i - 1];
      const curr = result.dots[i];
      expect(prev).toBeDefined();
      expect(curr).toBeDefined();
      expect(curr!.x).toBeGreaterThan(prev!.x);
    }
  });

  it("yTicks: 3-5 count, strictly increasing values", () => {
    const result = geo(points);
    expect(result.yTicks.length).toBeGreaterThanOrEqual(3);
    expect(result.yTicks.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < result.yTicks.length; i += 1) {
      expect(result.yTicks[i]!.value).toBeGreaterThan(result.yTicks[i - 1]!.value);
    }
  });
});

describe("computeWeightChartGeometry — band", () => {
  const points = [
    { t: 1000, grams: 24000 },
    { t: 2000, grams: 24500 },
  ];

  it("expands yDomain when the band range exceeds the data range", () => {
    const band: WeightBand = { minGrams: 10000, maxGrams: 40000, breedName: "Labrador Retriever" };
    const result = geo(points, band);
    expect(result.yDomain[0]).toBeLessThanOrEqual(10000);
    expect(result.yDomain[1]).toBeGreaterThanOrEqual(40000);
  });

  it("band.y/height are finite, positive-height, and within the plot", () => {
    const band: WeightBand = { minGrams: 10000, maxGrams: 40000, breedName: "Labrador Retriever" };
    const result = geo(points, band);
    expect(result.band).not.toBeNull();
    expect(Number.isFinite(result.band?.y)).toBe(true);
    expect(Number.isFinite(result.band?.height)).toBe(true);
    // Orientation guard (non-vacuity): larger grams map to smaller y, so the
    // band's `height` (bottom-of-band y minus top-of-band y) must be
    // strictly positive -- an inverted y-range would make this negative
    // while still keeping both endpoints inside the plot bounds.
    expect(result.band?.height ?? -1).toBeGreaterThan(0);
    expect(result.band?.y ?? -Infinity).toBeGreaterThanOrEqual(PADDING);
    expect((result.band?.y ?? 0) + (result.band?.height ?? 0)).toBeLessThanOrEqual(HEIGHT - PADDING + 0.0001);
  });

  it("returns band:null when no band is provided", () => {
    const result = geo(points, null);
    expect(result.band).toBeNull();
  });
});
