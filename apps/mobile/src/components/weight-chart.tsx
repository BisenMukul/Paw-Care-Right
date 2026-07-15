import { Text, View } from "react-native";
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";

import { strings } from "../strings";
import type { WeightBand } from "../weight/breed-weight-band";
import { computeWeightChartGeometry } from "../weight/weight-chart-geometry";
import type { WeightUnit } from "../weight/weight-units";

export interface WeightChartProps {
  points: Array<{ t: number; grams: number }>;
  band: WeightBand | null;
  unit: WeightUnit;
  width?: number;
  height?: number;
}

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 200;
const PADDING = 32;

/**
 * Presentational weight line chart (T065 plan): pure props in, SVG out --
 * no data fetching inside. When a breed band is present it renders as a
 * shaded region plus a strictly factual caption ("Typical adult range for
 * {breed}") -- neutral reference information only (CLAUDE §7 / plan Safety
 * statement); no interpretive/judgmental copy anywhere here. SVG structural
 * props are exempt from NativeWind (CLAUDE §6) -- the wrapper `View` uses
 * classes instead.
 */
export function WeightChart({
  points,
  band,
  unit,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: WeightChartProps) {
  const geometry = computeWeightChartGeometry({ points, band, unit, width, height, padding: PADDING });

  if (geometry.isEmpty) {
    return (
      <View testID="weight-chart-empty" className="items-center justify-center py-8">
        <Text className="text-center text-base text-brand-900">{strings.weight.empty}</Text>
      </View>
    );
  }

  return (
    <View className="gap-2">
      <Svg testID="weight-chart-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {geometry.band ? (
          <Rect
            testID="weight-chart-band"
            x={PADDING}
            y={geometry.band.y}
            width={width - PADDING * 2}
            height={geometry.band.height}
            fill="#DCEEDC"
          />
        ) : null}
        {geometry.yTicks.map((tick, index) => (
          <G key={`tick-${index}`}>
            <Line x1={PADDING} y1={tick.y} x2={width - PADDING} y2={tick.y} stroke="#E2E8F0" strokeWidth={1} />
            <SvgText x={2} y={tick.y} fontSize={10} fill="#475569">
              {tick.label}
            </SvgText>
          </G>
        ))}
        <Line x1={PADDING} y1={PADDING} x2={PADDING} y2={height - PADDING} stroke="#94A3B8" strokeWidth={1} />
        <Line
          x1={PADDING}
          y1={height - PADDING}
          x2={width - PADDING}
          y2={height - PADDING}
          stroke="#94A3B8"
          strokeWidth={1}
        />
        <Path d={geometry.linePath} stroke="#2563EB" strokeWidth={2} fill="none" />
        {geometry.dots.map((dot, index) => (
          <Circle key={`dot-${index}`} cx={dot.x} cy={dot.y} r={3} fill="#2563EB" />
        ))}
      </Svg>
      {band ? (
        <Text testID="weight-chart-band-caption" className="text-center text-xs text-brand-700">
          {strings.weight.typicalRange(band.breedName)}
        </Text>
      ) : null}
    </View>
  );
}
