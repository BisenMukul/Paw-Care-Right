import { derivePetAgeLabel } from "../src/pets/pet-age";
import { strings } from "../src/strings";

// Age-util boundary tests (T025 plan §Tests). `now` is passed explicitly in
// every case so results are deterministic without mocking the system clock.
const { age } = strings.petHome;

describe("derivePetAgeLabel", () => {
  const now = new Date("2024-06-15T00:00:00.000Z");

  it("returns '0 mo' when birthDate is the same day as now", () => {
    expect(
      derivePetAgeLabel({ birthDate: "2024-06-15T00:00:00.000Z", ageEstimateMonths: null }, now),
    ).toBe(`0 ${age.mo}`);
  });

  it("returns '11 mo' just under a year", () => {
    expect(
      derivePetAgeLabel({ birthDate: "2023-07-15T00:00:00.000Z", ageEstimateMonths: null }, now),
    ).toBe(`11 ${age.mo}`);
  });

  it("returns '1 yr' at exactly 12 months", () => {
    expect(
      derivePetAgeLabel({ birthDate: "2023-06-15T00:00:00.000Z", ageEstimateMonths: null }, now),
    ).toBe(`1 ${age.yr}`);
  });

  it("returns '1 yr 11 mo' at 23 months", () => {
    expect(
      derivePetAgeLabel({ birthDate: "2022-07-15T00:00:00.000Z", ageEstimateMonths: null }, now),
    ).toBe(`1 ${age.yr} 11 ${age.mo}`);
  });

  it("returns '2 yr 6 mo' for a multi-year pet (30 months)", () => {
    expect(
      derivePetAgeLabel({ birthDate: "2021-12-15T00:00:00.000Z", ageEstimateMonths: null }, now),
    ).toBe(`2 ${age.yr} 6 ${age.mo}`);
  });

  it("returns '~6 mo' for an ageEstimateMonths of 6", () => {
    expect(derivePetAgeLabel({ birthDate: null, ageEstimateMonths: 6 }, now)).toBe(
      `${age.approx}6 ${age.mo}`,
    );
  });

  it("returns '~1 yr' for an ageEstimateMonths of 18 (residual months dropped)", () => {
    expect(derivePetAgeLabel({ birthDate: null, ageEstimateMonths: 18 }, now)).toBe(
      `${age.approx}1 ${age.yr}`,
    );
  });

  it("returns 'Age unknown' when neither birthDate nor ageEstimateMonths is set", () => {
    expect(derivePetAgeLabel({ birthDate: null, ageEstimateMonths: null }, now)).toBe(age.unknown);
  });

  it("(guard) clamps a future birthDate to '0 mo', never negative", () => {
    expect(
      derivePetAgeLabel({ birthDate: "2025-01-01T00:00:00.000Z", ageEstimateMonths: null }, now),
    ).toBe(`0 ${age.mo}`);
  });
});
