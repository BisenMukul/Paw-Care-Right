import { Text, useColorScheme, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { strings } from "../../strings";

export interface CareScoreRingProps {
  value: number | null;
  testID?: string;
  /**
   * FIDELITY-2 plan §D: renders WHITE progress/track/number for hosting on
   * the deep-green care-hub hero (`bg-accent-dark`, white text verified
   * 6.39:1 AA in `dual-theme-contrast.test.ts`). Default `false` = this
   * component's existing (unhosted) behavior, byte-unchanged.
   */
  onDark?: boolean;
}

const SIZE = 82;
const CENTER = 41;
const RADIUS = 34;
const STROKE_WIDTH = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * Presentational Care Score ring (FIDELITY-1 plan; mockup geometry
 * `docs/design/pawsaathi.dc.html` ~58-99). Static SVG -- no animation
 * (design-system §7 R6 one-loop rule: the home gradient is the home's single
 * loop; a static ring also makes the reduced-motion contract trivially
 * satisfied). Stroke colors are chosen at runtime via `useColorScheme` from
 * the documented §1.1a dark pairing only (no new contrast math -- plan R3):
 * progress `#1f6350` light / `#2EA57C` dark, track `#E7E0D3` light /
 * `#22392F` dark (decorative, exempt from the essential-info floor -- the
 * number conveys the value). `value === null` renders the track only, no
 * progress arc, and the honest `scorePlaceholder` glyph centred (plan R4 --
 * never a fake 0/100). FIDELITY-2 plan §D adds the `onDark` white variant
 * for the deep-green care-hub hero -- `onDark` false (default) is this
 * component's byte-unchanged original behavior.
 */
export function CareScoreRing({ value, testID, onDark = false }: CareScoreRingProps) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const progressColor = onDark ? "#ffffff" : isDark ? "#2EA57C" : "#1f6350";
  const trackColor = onDark ? "rgba(255,255,255,0.3)" : isDark ? "#22392F" : "#E7E0D3";
  const clamped = value !== null ? clampScore(value) : null;
  const offset = clamped !== null ? CIRCUMFERENCE * (1 - clamped / 100) : CIRCUMFERENCE;

  return (
    <View
      testID={testID}
      style={{ width: SIZE, height: SIZE }}
      className="items-center justify-center"
    >
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Circle
          {...(testID ? { testID: `${testID}-track` } : {})}
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          stroke={trackColor}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        {clamped !== null ? (
          <Circle
            {...(testID ? { testID: `${testID}-progress` } : {})}
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke={progressColor}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${CENTER} ${CENTER})`}
          />
        ) : null}
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Text
          {...(testID ? { testID: `${testID}-value` } : {})}
          maxFontSizeMultiplier={1.5}
          className={
            onDark
              ? "font-display text-2xl font-bold text-white"
              : "font-display text-2xl font-bold text-brand-900 dark:text-ink-dark"
          }
        >
          {clamped !== null ? String(Math.round(clamped)) : strings.careScore.scorePlaceholder}
        </Text>
      </View>
    </View>
  );
}
