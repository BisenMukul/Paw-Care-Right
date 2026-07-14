import { deriveTemplateStartAt, petAgeMonths } from "./template-anchors";

describe("petAgeMonths", () => {
  it("computes whole months from birthDate to now when birthDate is known", () => {
    const birthDate = new Date("2025-01-15T00:00:00.000Z");
    const now = new Date("2026-07-14T00:00:00.000Z");

    expect(petAgeMonths({ birthDate, ageEstimateMonths: null }, now)).toBe(17);
  });

  it("rounds down when `now`'s day-of-month precedes birthDate's day-of-month", () => {
    const birthDate = new Date("2025-01-20T00:00:00.000Z");
    const now = new Date("2026-07-14T00:00:00.000Z"); // 14 < 20 -> not yet the 18-month mark

    expect(petAgeMonths({ birthDate, ageEstimateMonths: null }, now)).toBe(17);
  });

  it("falls back to ageEstimateMonths when birthDate is unknown", () => {
    expect(petAgeMonths({ birthDate: null, ageEstimateMonths: 6 }, new Date("2026-07-14T00:00:00.000Z"))).toBe(6);
  });

  it("returns null when neither birthDate nor ageEstimateMonths is known", () => {
    expect(petAgeMonths({ birthDate: null, ageEstimateMonths: null }, new Date("2026-07-14T00:00:00.000Z"))).toBeNull();
  });
});

describe("deriveTemplateStartAt", () => {
  const now = new Date("2026-07-14T00:00:00.000Z");

  it("PLAN_START: startAt = now + startOffsetDays, regardless of pet age", () => {
    const result = deriveTemplateStartAt(
      { anchor: "PLAN_START", startOffsetDays: 10 },
      { birthDate: null, ageEstimateMonths: null },
      now,
    );

    expect(result).toEqual(new Date("2026-07-24T00:00:00.000Z"));
  });

  it("PET_AGE with a known birthDate: startAt = birthDate + startOffsetDays", () => {
    const birthDate = new Date("2026-06-01T00:00:00.000Z");

    const result = deriveTemplateStartAt(
      { anchor: "PET_AGE", startOffsetDays: 14 },
      { birthDate, ageEstimateMonths: null },
      now,
    );

    expect(result).toEqual(new Date("2026-06-15T00:00:00.000Z"));
  });

  it("PET_AGE with only ageEstimateMonths: derives a pseudo-birthdate (now - ageEstimateMonths) then adds startOffsetDays", () => {
    const result = deriveTemplateStartAt(
      { anchor: "PET_AGE", startOffsetDays: 0 },
      { birthDate: null, ageEstimateMonths: 3 },
      now,
    );

    // now (2026-07-14) minus 3 calendar months = 2026-04-14.
    expect(result).toEqual(new Date("2026-04-14T00:00:00.000Z"));
  });

  it("PET_AGE with no derivable birth date (both null) -> null (caller skips the item)", () => {
    const result = deriveTemplateStartAt(
      { anchor: "PET_AGE", startOffsetDays: 0 },
      { birthDate: null, ageEstimateMonths: null },
      now,
    );

    expect(result).toBeNull();
  });
});
