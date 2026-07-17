import type { ActivityType, ActivityUnit } from "@pawcareright/types";
import { ACTIVITY_TYPES } from "@pawcareright/types";
import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

type IconName = ComponentProps<typeof Ionicons>["name"];

/**
 * The quantity/unit control an activity type presents in the sheet
 * (design-system §5.2, collapsed onto the shared `unit` enum -- see
 * `@pawcareright/types`' `health-log.ts` header for why).
 *
 * - `stepperWithUnit` (FOOD/WATER): an integer stepper plus a two-way unit
 *   segment toggle (`defaultUnit` <-> `altUnit`), each with its own step/range.
 * - `countWithChips` (POTTY): an integer count stepper plus a categorical
 *   unit chip row (`chipUnits`).
 * - `duration` (SLEEP/WALK/PLAY): an integer stepper only, unit fixed to
 *   `"min"`.
 * - `chipsOnly` (GROOMING): a categorical unit chip row only, no quantity.
 */
export type ActivityControl = "stepperWithUnit" | "countWithChips" | "duration" | "chipsOnly";

export interface StepRange {
  min: number;
  max: number;
  step: number;
}

export interface ActivityTypeConfig {
  icon: IconName;
  control: ActivityControl;
  defaultQuantity: number | undefined;
  defaultUnit: ActivityUnit;
  defaultRange: StepRange;
  /** FOOD/WATER's alternate unit + its own step range (undefined = no toggle). */
  altUnit?: ActivityUnit;
  altRange?: StepRange;
  /** Categorical options for `countWithChips`/`chipsOnly` controls. */
  chipUnits?: readonly ActivityUnit[];
}

/**
 * Per-type defaults (design-system §5.2's table), with `quantity` kept a
 * plain positive integer everywhere (see `@pawcareright/types` header --
 * design-system's 0.5-step meals/bowls is simplified to a whole-unit step
 * of 1, flagged for the checker).
 */
export const ACTIVITY_TYPE_CONFIG: Record<ActivityType, ActivityTypeConfig> = {
  FOOD: {
    icon: "restaurant-outline",
    control: "stepperWithUnit",
    defaultQuantity: 1,
    defaultUnit: "meals",
    defaultRange: { min: 1, max: 5, step: 1 },
    altUnit: "grams",
    altRange: { min: 10, max: 1000, step: 10 },
  },
  WATER: {
    icon: "water-outline",
    control: "stepperWithUnit",
    defaultQuantity: 1,
    defaultUnit: "bowls",
    defaultRange: { min: 1, max: 5, step: 1 },
    altUnit: "ml",
    altRange: { min: 25, max: 1000, step: 25 },
  },
  POTTY: {
    icon: "paw-outline",
    control: "countWithChips",
    defaultQuantity: 1,
    defaultUnit: "pee",
    defaultRange: { min: 1, max: 5, step: 1 },
    chipUnits: ["pee", "poop", "both"],
  },
  SLEEP: {
    icon: "moon-outline",
    control: "duration",
    defaultQuantity: 60,
    defaultUnit: "min",
    defaultRange: { min: 15, max: 1440, step: 15 },
  },
  WALK: {
    icon: "walk-outline",
    control: "duration",
    defaultQuantity: 20,
    defaultUnit: "min",
    defaultRange: { min: 5, max: 180, step: 5 },
  },
  PLAY: {
    icon: "tennisball-outline",
    control: "duration",
    defaultQuantity: 15,
    defaultUnit: "min",
    defaultRange: { min: 5, max: 120, step: 5 },
  },
  GROOMING: {
    icon: "cut-outline",
    control: "chipsOnly",
    defaultQuantity: undefined,
    defaultUnit: "brush",
    defaultRange: { min: 0, max: 0, step: 0 },
    chipUnits: ["brush", "bath", "nails", "teeth", "ears"],
  },
};

/** Fixed display order for the chip grid (design-system §5.1's list order). */
export const ACTIVITY_TYPES_ORDER: readonly ActivityType[] = ACTIVITY_TYPES;

export function clampQuantity(value: number, range: StepRange): number {
  return Math.min(range.max, Math.max(range.min, value));
}
