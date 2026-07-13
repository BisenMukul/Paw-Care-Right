import { evaluateRedFlags } from "@pawcareright/ai";
import type { CompletedIntake } from "@pawcareright/types";
import { parseIntake } from "@pawcareright/types";

import { buildRedFlagIntake, type PetProfileInput } from "./red-flag-intake.mapper";

const NOW = new Date("2026-07-13T00:00:00.000Z");

function basePet(overrides: Partial<PetProfileInput> = {}): PetProfileInput {
  return {
    species: "DOG",
    sex: "UNKNOWN",
    ageEstimateMonths: null,
    birthDate: null,
    weightGrams: null,
    ...overrides,
  };
}

function intake(raw: unknown): CompletedIntake {
  const parsed = parseIntake(raw);
  if (!parsed.ok) {
    throw new Error(`test fixture intake failed to parse: ${parsed.reason}`);
  }
  return parsed.value;
}

function urinaryIntake(opts: {
  difficulty: string;
  bloodInUrine: string;
  freeText?: string;
}): CompletedIntake {
  return intake({
    category: "urinary",
    answers: [
      { questionId: "onset", type: "duration", value: 2, unit: "hours" },
      { questionId: "difficulty", type: "single", value: opts.difficulty },
      { questionId: "blood-in-urine", type: "single", value: opts.bloodInUrine },
      { questionId: "energy", type: "scale", value: 3 },
    ],
    ...(opts.freeText !== undefined ? { freeText: opts.freeText } : {}),
  });
}

function breathingIntake(opts: { character: string; gumColor: string }): CompletedIntake {
  return intake({
    category: "breathing",
    answers: [
      { questionId: "onset", type: "duration", value: 2, unit: "hours" },
      { questionId: "character", type: "single", value: opts.character },
      { questionId: "gum-color", type: "single", value: opts.gumColor },
      { questionId: "energy", type: "scale", value: 3 },
    ],
  });
}

function injuryIntake(opts: { what: string; bleeding: string; consciousness: string }): CompletedIntake {
  return intake({
    category: "injury",
    answers: [
      { questionId: "what", type: "single", value: opts.what },
      { questionId: "bleeding", type: "single", value: opts.bleeding },
      { questionId: "location", type: "multi", values: ["leg"] },
      { questionId: "consciousness", type: "single", value: opts.consciousness },
    ],
  });
}

describe("buildRedFlagIntake — mapping rows (T032 plan R2 table)", () => {
  it("urinary/difficulty=straining -> straining_to_urinate (CAT triggers urinary-blockage-cat)", () => {
    const pet = basePet({ species: "CAT" });
    const completed = urinaryIntake({ difficulty: "straining", bloodInUrine: "no" });

    const result = buildRedFlagIntake(pet, completed, NOW);

    expect(result.signs?.straining_to_urinate).toBe(true);
    expect(evaluateRedFlags(result).highest).not.toBeNull();
  });

  it("urinary/difficulty=cannot-urinate -> straining_to_urinate (CAT triggers urinary-blockage-cat)", () => {
    const pet = basePet({ species: "CAT" });
    const completed = urinaryIntake({ difficulty: "cannot-urinate", bloodInUrine: "no" });

    const result = buildRedFlagIntake(pet, completed, NOW);

    expect(result.signs?.straining_to_urinate).toBe(true);
    expect(evaluateRedFlags(result).highest).not.toBeNull();
  });

  it("urinary/blood-in-urine=yes -> blood_in_urine (no standalone rule; combo rule needs straining too, documented gap)", () => {
    const pet = basePet({ species: "CAT" });
    const completed = urinaryIntake({ difficulty: "normal", bloodInUrine: "yes" });

    const result = buildRedFlagIntake(pet, completed, NOW);

    expect(result.signs?.blood_in_urine).toBe(true);
    // Rule `urinary-obstruction-signs-cat` requires BOTH straining_to_urinate
    // AND blood_in_urine — blood_in_urine alone matches no rule in the
    // table, so `highest` is null here. Combined with straining (see the
    // dedicated "combination" test below), the combo rule fires.
    expect(evaluateRedFlags(result).highest).toBeNull();
  });

  it("urinary/blood-in-urine=yes + difficulty=straining, CAT -> both signs fire the combo rule", () => {
    const pet = basePet({ species: "CAT" });
    const completed = urinaryIntake({ difficulty: "straining", bloodInUrine: "yes" });

    const result = buildRedFlagIntake(pet, completed, NOW);

    expect(result.signs?.straining_to_urinate).toBe(true);
    expect(result.signs?.blood_in_urine).toBe(true);
    expect(evaluateRedFlags(result).highest).not.toBeNull();
  });

  it("breathing/character=labored -> breathing_difficulty", () => {
    const pet = basePet();
    const completed = breathingIntake({ character: "labored", gumColor: "pink" });

    const result = buildRedFlagIntake(pet, completed, NOW);

    expect(result.signs?.breathing_difficulty).toBe(true);
    expect(evaluateRedFlags(result).highest).not.toBeNull();
  });

  it("breathing/character=open-mouth-cat -> breathing_difficulty", () => {
    const pet = basePet({ species: "CAT" });
    const completed = breathingIntake({ character: "open-mouth-cat", gumColor: "pink" });

    const result = buildRedFlagIntake(pet, completed, NOW);

    expect(result.signs?.breathing_difficulty).toBe(true);
    expect(evaluateRedFlags(result).highest).not.toBeNull();
  });

  it("breathing/character=gasping -> breathing_difficulty", () => {
    const pet = basePet();
    const completed = breathingIntake({ character: "gasping", gumColor: "pink" });

    const result = buildRedFlagIntake(pet, completed, NOW);

    expect(result.signs?.breathing_difficulty).toBe(true);
    expect(evaluateRedFlags(result).highest).not.toBeNull();
  });

  it("breathing/gum-color=pale-white -> abnormal_gum_color", () => {
    const pet = basePet();
    const completed = breathingIntake({ character: "normal", gumColor: "pale-white" });

    const result = buildRedFlagIntake(pet, completed, NOW);

    expect(result.signs?.abnormal_gum_color).toBe(true);
    expect(evaluateRedFlags(result).highest).not.toBeNull();
  });

  it("breathing/gum-color=blue-purple -> abnormal_gum_color", () => {
    const pet = basePet();
    const completed = breathingIntake({ character: "normal", gumColor: "blue-purple" });

    const result = buildRedFlagIntake(pet, completed, NOW);

    expect(result.signs?.abnormal_gum_color).toBe(true);
    expect(evaluateRedFlags(result).highest).not.toBeNull();
  });

  it("injury/what=hit-by-vehicle -> major_trauma", () => {
    const pet = basePet();
    const completed = injuryIntake({ what: "hit-by-vehicle", bleeding: "none", consciousness: "alert" });

    const result = buildRedFlagIntake(pet, completed, NOW);

    expect(result.signs?.major_trauma).toBe(true);
    expect(evaluateRedFlags(result).highest).not.toBeNull();
  });

  it("injury/bleeding=heavy -> uncontrolled_bleeding", () => {
    const pet = basePet();
    const completed = injuryIntake({ what: "cut-or-wound", bleeding: "heavy", consciousness: "alert" });

    const result = buildRedFlagIntake(pet, completed, NOW);

    expect(result.signs?.uncontrolled_bleeding).toBe(true);
    expect(evaluateRedFlags(result).highest).not.toBeNull();
  });

  it("injury/consciousness=unresponsive -> collapse_unresponsive", () => {
    const pet = basePet();
    const completed = injuryIntake({ what: "fall", bleeding: "none", consciousness: "unresponsive" });

    const result = buildRedFlagIntake(pet, completed, NOW);

    expect(result.signs?.collapse_unresponsive).toBe(true);
    expect(evaluateRedFlags(result).highest).not.toBeNull();
  });

  it("benign intake (no red-flag answers, benign freeText) -> no signs set, highest === null", () => {
    const pet = basePet();
    const completed = urinaryIntake({
      difficulty: "normal",
      bloodInUrine: "no",
      freeText: "Just seems a little tired today.",
    });

    const result = buildRedFlagIntake(pet, completed, NOW);

    expect(result.signs?.straining_to_urinate).toBeUndefined();
    expect(result.signs?.blood_in_urine).toBeUndefined();
    expect(evaluateRedFlags(result).highest).toBeNull();
  });
});

describe("buildRedFlagIntake — profile derivation", () => {
  it("species and sex pass through 1:1", () => {
    const pet = basePet({ species: "CAT", sex: "FEMALE" });
    const completed = urinaryIntake({ difficulty: "normal", bloodInUrine: "no" });

    const result = buildRedFlagIntake(pet, completed, NOW);

    expect(result.species).toBe("CAT");
    expect(result.sex).toBe("FEMALE");
  });

  it("ageMonths prefers ageEstimateMonths over birthDate when both would be derivable", () => {
    const pet = basePet({ ageEstimateMonths: 18, birthDate: new Date("2020-01-01T00:00:00.000Z") });
    const completed = urinaryIntake({ difficulty: "normal", bloodInUrine: "no" });

    const result = buildRedFlagIntake(pet, completed, NOW);

    expect(result.ageMonths).toBe(18);
  });

  it("ageMonths derives whole months from birthDate when ageEstimateMonths is null", () => {
    // 2024-01-13 -> 2026-07-13 is exactly 30 months.
    const pet = basePet({ ageEstimateMonths: null, birthDate: new Date("2024-01-13T00:00:00.000Z") });
    const completed = urinaryIntake({ difficulty: "normal", bloodInUrine: "no" });

    const result = buildRedFlagIntake(pet, completed, NOW);

    expect(result.ageMonths).toBe(30);
  });

  it("ageMonths derived from birthDate is clamped to a minimum of 0", () => {
    const pet = basePet({ ageEstimateMonths: null, birthDate: new Date("2099-01-01T00:00:00.000Z") });
    const completed = urinaryIntake({ difficulty: "normal", bloodInUrine: "no" });

    const result = buildRedFlagIntake(pet, completed, NOW);

    expect(result.ageMonths).toBe(0);
  });

  it("ageMonths is undefined when both ageEstimateMonths and birthDate are null", () => {
    const pet = basePet({ ageEstimateMonths: null, birthDate: null });
    const completed = urinaryIntake({ difficulty: "normal", bloodInUrine: "no" });

    const result = buildRedFlagIntake(pet, completed, NOW);

    expect(result.ageMonths).toBeUndefined();
  });

  it("weightKg = weightGrams / 1000", () => {
    const pet = basePet({ weightGrams: 4500 });
    const completed = urinaryIntake({ difficulty: "normal", bloodInUrine: "no" });

    const result = buildRedFlagIntake(pet, completed, NOW);

    expect(result.weightKg).toBe(4.5);
  });

  it("weightKg is undefined when weightGrams is null", () => {
    const pet = basePet({ weightGrams: null });
    const completed = urinaryIntake({ difficulty: "normal", bloodInUrine: "no" });

    const result = buildRedFlagIntake(pet, completed, NOW);

    expect(result.weightKg).toBeUndefined();
  });

  it("sizeClass is always omitted (plan D8 — not on the Pet model)", () => {
    const pet = basePet();
    const completed = urinaryIntake({ difficulty: "normal", bloodInUrine: "no" });

    const result = buildRedFlagIntake(pet, completed, NOW);

    expect(result.sizeClass).toBeUndefined();
  });

  it("freeText passes through when present, omitted when absent", () => {
    const pet = basePet();
    const withText = buildRedFlagIntake(
      pet,
      urinaryIntake({ difficulty: "normal", bloodInUrine: "no", freeText: "owner note" }),
      NOW,
    );
    const withoutText = buildRedFlagIntake(pet, urinaryIntake({ difficulty: "normal", bloodInUrine: "no" }), NOW);

    expect(withText.freeText).toBe("owner note");
    expect(withoutText.freeText).toBeUndefined();
  });
});
