// T110 AC3 (group F): date/decimal/weight-unit localization.
import { formatDecimal, formatEntryDate } from "../src/i18n/format";
import { formatCheckDate } from "../src/checks/check-history";
import {
  WEIGHT_MAX_GRAMS,
  WEIGHT_MIN_GRAMS,
  defaultUnitForRegion,
  formatWeight,
  gramsToDisplay,
} from "../src/weight/weight-units";

describe("formatEntryDate keeps the existing ISO convention for en", () => {
  it.each([
    "2024-01-01T00:00:00.000Z",
    "2024-03-05T10:00:00.000Z",
    "2020-12-31T23:59:59.999Z",
  ])("%s", (iso) => {
    expect(formatEntryDate(iso, "en")).toBe(new Date(iso).toISOString().slice(0, 10));
  });
});

describe("formatEntryDate localizes es, pt-BR, hi and ar", () => {
  const iso = "2024-03-05T10:00:00.000Z";

  it("es", () => {
    expect(formatEntryDate(iso, "es")).toBe("5 de marzo de 2024");
  });

  it("pt-BR", () => {
    expect(formatEntryDate(iso, "pt-BR")).toBe("5 de março de 2024");
  });

  it("hi", () => {
    expect(formatEntryDate(iso, "hi")).toBe("5 मार्च 2024");
  });

  it("ar", () => {
    expect(formatEntryDate(iso, "ar")).toBe("5 مارس 2024");
  });

  it("every localized output is non-ISO (deterministic, but not YYYY-MM-DD)", () => {
    for (const locale of ["es", "pt-BR", "hi", "ar"] as const) {
      expect(formatEntryDate(iso, locale)).not.toBe("2024-03-05");
    }
  });
});

describe("formatEntryDate is timezone-stable", () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
  });

  it("identical output under two different process.env.TZ values", () => {
    const iso = "2024-03-05T23:30:00.000Z";

    process.env.TZ = "America/Los_Angeles";
    const first = formatEntryDate(iso, "es");

    process.env.TZ = "Asia/Kolkata";
    const second = formatEntryDate(iso, "es");

    expect(first).toBe(second);
    expect(first).toBe("5 de marzo de 2024");
  });
});

describe("formatDecimal uses the locale's decimal separator", () => {
  it("en -> \"25.0\"", () => {
    expect(formatDecimal(25, "en")).toBe("25.0");
  });

  it("es -> \"25,0\"", () => {
    expect(formatDecimal(25, "es")).toBe("25,0");
  });

  it("pt-BR -> \"25,0\"", () => {
    expect(formatDecimal(25, "pt-BR")).toBe("25,0");
  });

  it("hi -> \"25.0\"", () => {
    expect(formatDecimal(25, "hi")).toBe("25.0");
  });
});

describe("formatWeight is byte-identical to the pre-T110 toFixed(1) output for en", () => {
  function preT110Format(grams: number, unit: "kg" | "lb"): string {
    return `${gramsToDisplay(grams, unit).toFixed(1)} ${unit}`;
  }

  it("matches across the legal domain (incl. WEIGHT_MIN_GRAMS/WEIGHT_MAX_GRAMS), both units", () => {
    const STEP = 37;
    const samples = new Set<number>([WEIGHT_MIN_GRAMS, WEIGHT_MAX_GRAMS]);
    for (let grams = WEIGHT_MIN_GRAMS; grams <= WEIGHT_MAX_GRAMS; grams += STEP) {
      samples.add(grams);
    }
    for (const grams of samples) {
      for (const unit of ["kg", "lb"] as const) {
        expect(formatWeight(grams, unit)).toBe(preT110Format(grams, unit));
        expect(formatWeight(grams, unit, "en")).toBe(preT110Format(grams, unit));
      }
    }
  });
});

describe("the default weight unit follows the device region, not the language", () => {
  it.each([
    ["US", "lb"],
    ["LR", "lb"],
    ["MM", "lb"],
    ["ES", "kg"],
    ["BR", "kg"],
    ["IN", "kg"],
    ["AE", "kg"],
    [undefined, "kg"],
  ] as const)("%s -> %s", (region, unit) => {
    expect(defaultUnitForRegion(region)).toBe(unit);
  });
});

describe("formatCheckDate output is unchanged while en is the served locale", () => {
  it("pins the existing check-history behaviour end-to-end", () => {
    const iso = "2024-03-05T10:00:00.000Z";
    expect(formatCheckDate(iso)).toBe(new Date(iso).toISOString().slice(0, 10));
    expect(formatCheckDate(iso)).toBe("2024-03-05");
  });
});
