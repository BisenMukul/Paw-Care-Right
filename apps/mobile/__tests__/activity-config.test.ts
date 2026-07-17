import { ACTIVITY_TYPES } from "@pawcareright/types";

import { ACTIVITY_TYPE_CONFIG, ACTIVITY_TYPES_ORDER, clampQuantity } from "../src/health-logs/activity-config";

describe("ACTIVITY_TYPE_CONFIG", () => {
  it("has an entry for every ActivityType, in the design-system §5 order", () => {
    expect(ACTIVITY_TYPES_ORDER).toEqual(ACTIVITY_TYPES);
    for (const type of ACTIVITY_TYPES) {
      expect(ACTIVITY_TYPE_CONFIG[type]).toBeDefined();
    }
  });

  it("FOOD/WATER are stepperWithUnit with a distinct altUnit + altRange", () => {
    expect(ACTIVITY_TYPE_CONFIG.FOOD.control).toBe("stepperWithUnit");
    expect(ACTIVITY_TYPE_CONFIG.FOOD.altUnit).toBe("grams");
    expect(ACTIVITY_TYPE_CONFIG.WATER.control).toBe("stepperWithUnit");
    expect(ACTIVITY_TYPE_CONFIG.WATER.altUnit).toBe("ml");
  });

  it("POTTY is countWithChips with pee/poop/both chip options", () => {
    expect(ACTIVITY_TYPE_CONFIG.POTTY.control).toBe("countWithChips");
    expect(ACTIVITY_TYPE_CONFIG.POTTY.chipUnits).toEqual(["pee", "poop", "both"]);
  });

  it("SLEEP/WALK/PLAY are duration-only, unit fixed to min", () => {
    for (const type of ["SLEEP", "WALK", "PLAY"] as const) {
      expect(ACTIVITY_TYPE_CONFIG[type].control).toBe("duration");
      expect(ACTIVITY_TYPE_CONFIG[type].defaultUnit).toBe("min");
    }
  });

  it("GROOMING is chipsOnly with no default quantity", () => {
    expect(ACTIVITY_TYPE_CONFIG.GROOMING.control).toBe("chipsOnly");
    expect(ACTIVITY_TYPE_CONFIG.GROOMING.defaultQuantity).toBeUndefined();
    expect(ACTIVITY_TYPE_CONFIG.GROOMING.chipUnits).toEqual(["brush", "bath", "nails", "teeth", "ears"]);
  });

  it("every default falls within its own default range", () => {
    for (const type of ACTIVITY_TYPES) {
      const config = ACTIVITY_TYPE_CONFIG[type];
      if (config.defaultQuantity !== undefined) {
        expect(config.defaultQuantity).toBeGreaterThanOrEqual(config.defaultRange.min);
        expect(config.defaultQuantity).toBeLessThanOrEqual(config.defaultRange.max);
      }
    }
  });
});

describe("clampQuantity", () => {
  const range = { min: 5, max: 20, step: 5 };

  it("passes a value already inside the range through unchanged", () => {
    expect(clampQuantity(10, range)).toBe(10);
  });

  it("clamps below the minimum up to the minimum", () => {
    expect(clampQuantity(0, range)).toBe(5);
  });

  it("clamps above the maximum down to the maximum", () => {
    expect(clampQuantity(100, range)).toBe(20);
  });
});
