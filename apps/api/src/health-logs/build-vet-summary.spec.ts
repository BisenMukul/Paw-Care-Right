import { readFileSync } from "node:fs";
import { join } from "node:path";

import { VET_SUMMARY_DISCLAIMER, VET_SUMMARY_MAX_CHARS } from "@pawcareright/types";

import { buildVetSummary, type VetSummaryInput } from "./build-vet-summary";

/**
 * Golden-file regeneration policy (T068 plan Create list item -- read this
 * before ever touching `__fixtures__/vet-summary.golden.txt`): the fixture
 * is the checked-in, byte-exact, no-trailing-newline output of
 * `buildVetSummary(GOLDEN_FIXTURE)`. `GOLDEN_FIXTURE` below uses ONLY fixed
 * UTC `Date` literals and data-derived values -- `buildVetSummary` never
 * reads the clock, so this file is a pure function of its input and the
 * golden is fully reproducible. To regenerate deliberately (e.g. after an
 * intentional wording/format change to `build-vet-summary.ts`): run
 * `console.log(JSON.stringify(buildVetSummary(GOLDEN_FIXTURE)))` from a
 * scratch script, paste the *exact* string (no added newline) into the
 * fixture file, and review the diff line-by-line -- never regenerate to
 * make a failing assertion pass without reading why it changed.
 */
const GOLDEN_FIXTURE: VetSummaryInput = {
  pet: { name: "Fido", species: "DOG", ageEstimateMonths: 34, birthDate: null },
  weights: [
    { occurredAt: new Date("2026-04-17T09:00:00.000Z"), grams: 10_000 },
    { occurredAt: new Date("2026-07-14T09:00:00.000Z"), grams: 10_500 },
  ],
  checks: [
    { createdAt: new Date("2026-07-10T14:00:00.000Z"), tier: "VET_SOON" },
    { createdAt: new Date("2026-06-01T08:00:00.000Z"), tier: "MONITOR" },
  ],
  medsGiven: [
    {
      occurredAt: new Date("2026-07-12T20:00:00.000Z"),
      nameAsEntered: "Amoxicillin",
      doseAsEntered: "1 tablet, twice daily",
    },
    { occurredAt: new Date("2026-06-15T20:00:00.000Z"), nameAsEntered: null, doseAsEntered: null },
  ],
  notes: [
    { occurredAt: new Date("2026-07-13T07:00:00.000Z"), text: "Ate less than usual this morning." },
    { occurredAt: new Date("2026-06-20T07:00:00.000Z"), text: "Seemed extra playful at the park." },
  ],
};

const EMPTY_FIXTURE: VetSummaryInput = {
  pet: { name: "Whiskers", species: "CAT", ageEstimateMonths: null, birthDate: null },
  weights: [],
  checks: [],
  medsGiven: [],
  notes: [],
};

/** 3 checks + 3 meds (small, fully fit) + 60 notes x ~200 chars (deliberately floods the budget). */
function buildOverflowFixture(): VetSummaryInput {
  const checks: VetSummaryInput["checks"] = Array.from({ length: 3 }, (_, i) => ({
    createdAt: new Date(Date.UTC(2026, 5, 1 + i)),
    tier: "MONITOR" as const,
  }));
  const medsGiven: VetSummaryInput["medsGiven"] = Array.from({ length: 3 }, (_, i) => ({
    occurredAt: new Date(Date.UTC(2026, 5, 1 + i)),
    nameAsEntered: `Med ${i}`,
    doseAsEntered: "as prescribed",
  }));
  const notes: VetSummaryInput["notes"] = Array.from({ length: 60 }, (_, i) => ({
    occurredAt: new Date(Date.UTC(2026, 6, 1) - i * 86_400_000),
    text: "N".repeat(200),
  }));

  return {
    pet: { name: "Rex", species: "DOG", ageEstimateMonths: 12, birthDate: null },
    weights: [{ occurredAt: new Date("2026-07-01T00:00:00.000Z"), grams: 20_000 }],
    checks,
    medsGiven,
    notes,
  };
}

const OVERFLOW_FIXTURE = buildOverflowFixture();

describe("buildVetSummary", () => {
  it("matches the golden file for the fixture pet", () => {
    const goldenPath = join(__dirname, "__fixtures__", "vet-summary.golden.txt");
    const expected = readFileSync(goldenPath, "utf8");

    expect(buildVetSummary(GOLDEN_FIXTURE)).toBe(expected);
  });

  it("never exceeds 2500 chars and keeps the footer intact when data overflows", () => {
    const output = buildVetSummary(OVERFLOW_FIXTURE);

    expect(output.length).toBeLessThanOrEqual(VET_SUMMARY_MAX_CHARS);
    expect(output.endsWith(VET_SUMMARY_DISCLAIMER)).toBe(true);
    expect(output).toContain("… (older entries omitted to keep this summary short)");
    // Checks (higher priority) survive in full -- all 3 dates present.
    expect(output).toContain("2026-06-01");
    expect(output).toContain("2026-06-02");
    expect(output).toContain("2026-06-03");
  });

  it.each([
    ["GOLDEN_FIXTURE", GOLDEN_FIXTURE],
    ["OVERFLOW_FIXTURE", OVERFLOW_FIXTURE],
    ["EMPTY_FIXTURE", EMPTY_FIXTURE],
  ])("footer is always the final block (%s)", (_name, fixture) => {
    const output = buildVetSummary(fixture as VetSummaryInput);
    expect(output.endsWith(VET_SUMMARY_DISCLAIMER)).toBe(true);
  });

  it("renders a minimal summary with explicit empty-section lines", () => {
    const output = buildVetSummary(EMPTY_FIXTURE);

    expect(output).toContain("Whiskers");
    expect(output).toContain("No weight entries.");
    expect(output).toContain("No symptom checks.");
    expect(output).toContain("No medications recorded.");
    expect(output).toContain("No notes.");
    expect(output.endsWith(VET_SUMMARY_DISCLAIMER)).toBe(true);
    expect(output.length).toBeLessThanOrEqual(VET_SUMMARY_MAX_CHARS);
  });

  it("labels each check with its recorded tier and shows awaiting assessment when none", () => {
    const input: VetSummaryInput = {
      ...EMPTY_FIXTURE,
      checks: [
        { createdAt: new Date("2026-07-10T00:00:00.000Z"), tier: "EMERGENCY_NOW" },
        { createdAt: new Date("2026-07-01T00:00:00.000Z"), tier: null },
      ],
    };

    const output = buildVetSummary(input);

    expect(output).toContain("2026-07-10: emergency now");
    expect(output).toContain("2026-07-01: awaiting assessment");
    expect(/diagnos/i.test(output)).toBe(false);
  });

  it("shows medication name/dose exactly as entered and the neutral fallback when absent", () => {
    const input: VetSummaryInput = {
      ...EMPTY_FIXTURE,
      medsGiven: [
        {
          occurredAt: new Date("2026-07-10T00:00:00.000Z"),
          nameAsEntered: "Rimadyl",
          doseAsEntered: "25mg once daily",
        },
        { occurredAt: new Date("2026-07-05T00:00:00.000Z"), nameAsEntered: "Rimadyl", doseAsEntered: null },
        { occurredAt: new Date("2026-07-01T00:00:00.000Z"), nameAsEntered: null, doseAsEntered: null },
      ],
    };

    const output = buildVetSummary(input);

    expect(output).toContain("2026-07-10: Rimadyl — 25mg once daily");
    expect(output).toContain("2026-07-05: Rimadyl");
    expect(output).toContain("2026-07-01: Medication given");
  });
});
