import { gramsToDisplay, type WeightUnit } from "./weight-units";
import type { WeightBand } from "./breed-weight-band";

export interface GeomPoint {
  x: number;
  y: number;
}

export interface YTick {
  value: number;
  y: number;
  label: string;
}

export interface WeightChartGeometry {
  isEmpty: boolean;
  linePath: string;
  dots: GeomPoint[];
  band: { y: number; height: number } | null;
  yTicks: YTick[];
  yDomain: [number, number];
  xDomain: [number, number];
}

export interface WeightChartGeometryInput {
  points: Array<{ t: number; grams: number }>;
  band: WeightBand | null;
  unit: WeightUnit;
  width: number;
  height: number;
  padding: number;
}

/** Fixed tick count — deterministic and always within the card's "3–5" range. */
const NUM_Y_TICKS = 4;

/** One display-unit worth of grams, used to pad a flat/single-point y-domain so it never has zero span. */
function oneDisplayUnitInGrams(unit: WeightUnit): number {
  return unit === "kg" ? 1000 : 453.592;
}

/**
 * Pure geometry for the weight line chart (T065 plan): scales a raw
 * `{ t, grams }` series (plus an optional breed band) into SVG viewBox
 * coordinates. No React, no rendering — `weight-chart.tsx` consumes this
 * directly. Two guarantees load-bearing for the ACs:
 *  - the y-domain never has zero span (a flat or single-point series is
 *    padded symmetrically by one display-unit worth of grams), so no
 *    division by zero ever occurs;
 *  - a present band expands the y-domain to fully contain it, so the band
 *    rect is always clamped within the plotted viewBox.
 */
export function computeWeightChartGeometry(input: WeightChartGeometryInput): WeightChartGeometry {
  const { points, band, unit, width, height, padding } = input;

  if (points.length === 0) {
    return {
      isEmpty: true,
      linePath: "",
      dots: [],
      band: null,
      yTicks: [],
      yDomain: [0, 0],
      xDomain: [0, 0],
    };
  }

  const gramsValues = points.map((p) => p.grams);
  const tValues = points.map((p) => p.t);

  const dataMinGrams = Math.min(...gramsValues);
  const dataMaxGrams = Math.max(...gramsValues);
  const xMin = Math.min(...tValues);
  const xMax = Math.max(...tValues);

  let yMin = dataMinGrams;
  let yMax = dataMaxGrams;
  if (yMin === yMax) {
    const pad = oneDisplayUnitInGrams(unit);
    yMin -= pad;
    yMax += pad;
  }

  // Band-outside-data case (plan decision 7 / risk): widen the y-domain so
  // the band is always fully inside the plotted range, never clipped.
  if (band !== null) {
    yMin = Math.min(yMin, band.minGrams);
    yMax = Math.max(yMax, band.maxGrams);
  }

  const plotTop = padding;
  const plotBottom = height - padding;
  const plotLeft = padding;
  const plotRight = width - padding;
  const ySpan = yMax - yMin;
  const xSpan = xMax - xMin;

  function mapY(grams: number): number {
    const clamped = Math.max(yMin, Math.min(yMax, grams));
    const t = (clamped - yMin) / ySpan;
    return plotBottom - t * (plotBottom - plotTop);
  }

  function mapX(t: number): number {
    if (points.length === 1 || xSpan === 0) {
      return (plotLeft + plotRight) / 2;
    }
    const xt = (t - xMin) / xSpan;
    return plotLeft + xt * (plotRight - plotLeft);
  }

  const dots: GeomPoint[] = points.map((p) => ({ x: mapX(p.t), y: mapY(p.grams) }));
  const linePath = dots.map((d, i) => `${i === 0 ? "M" : "L"} ${d.x} ${d.y}`).join(" ");

  let bandGeom: { y: number; height: number } | null = null;
  if (band !== null) {
    const bandTop = mapY(band.maxGrams);
    const bandBottom = mapY(band.minGrams);
    bandGeom = { y: bandTop, height: bandBottom - bandTop };
  }

  const yTicks: YTick[] = Array.from({ length: NUM_Y_TICKS }, (_, i) => {
    const fraction = i / (NUM_Y_TICKS - 1);
    const gramsAtTick = yMin + fraction * ySpan;
    return {
      value: gramsToDisplay(gramsAtTick, unit),
      y: mapY(gramsAtTick),
      label: `${gramsToDisplay(gramsAtTick, unit).toFixed(1)} ${unit}`,
    };
  });

  return {
    isEmpty: false,
    linePath,
    dots,
    band: bandGeom,
    yTicks,
    yDomain: [yMin, yMax],
    xDomain: [xMin, xMax],
  };
}
