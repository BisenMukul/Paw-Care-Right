import { createPetSchema, petSchema, SEX, sexSchema, SPECIES, speciesSchema, updatePetSchema } from "./pet";

describe("speciesSchema", () => {
  it("accepts every value in SPECIES", () => {
    for (const value of SPECIES) {
      expect(speciesSchema.safeParse(value).success).toBe(true);
    }
  });

  it("rejects an unknown species", () => {
    expect(speciesSchema.safeParse("BIRD").success).toBe(false);
  });
});

describe("sexSchema", () => {
  it("accepts every value in SEX", () => {
    for (const value of SEX) {
      expect(sexSchema.safeParse(value).success).toBe(true);
    }
  });

  it("rejects an unknown sex", () => {
    expect(sexSchema.safeParse("OTHER").success).toBe(false);
  });
});

describe("createPetSchema", () => {
  const minimal = { species: "DOG", name: "Fido" };

  it("accepts the minimal required shape", () => {
    expect(createPetSchema.safeParse(minimal).success).toBe(true);
  });

  it("rejects a missing name", () => {
    expect(createPetSchema.safeParse({ species: "DOG" }).success).toBe(false);
  });

  it("rejects a missing species", () => {
    expect(createPetSchema.safeParse({ name: "Fido" }).success).toBe(false);
  });

  it("accepts birthDate alone", () => {
    const result = createPetSchema.safeParse({ ...minimal, birthDate: "2020-01-01T00:00:00.000Z" });
    expect(result.success).toBe(true);
  });

  it("accepts ageEstimateMonths alone", () => {
    const result = createPetSchema.safeParse({ ...minimal, ageEstimateMonths: 6 });
    expect(result.success).toBe(true);
  });

  it("accepts neither birthDate nor ageEstimateMonths", () => {
    expect(createPetSchema.safeParse(minimal).success).toBe(true);
  });

  it("rejects both birthDate and ageEstimateMonths set (XOR superRefine)", () => {
    const result = createPetSchema.safeParse({
      ...minimal,
      birthDate: "2020-01-01T00:00:00.000Z",
      ageEstimateMonths: 6,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["ageEstimateMonths"]);
    }
  });
});

describe("updatePetSchema", () => {
  it("accepts an empty object (partial — nothing required)", () => {
    expect(updatePetSchema.safeParse({}).success).toBe(true);
  });

  it("accepts explicit nulls clearing nullable fields", () => {
    const result = updatePetSchema.safeParse({
      breedSlug: null,
      birthDate: null,
      ageEstimateMonths: null,
      weightGrams: null,
      photoKey: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects both birthDate and ageEstimateMonths set", () => {
    const result = updatePetSchema.safeParse({
      birthDate: "2020-01-01T00:00:00.000Z",
      ageEstimateMonths: 6,
    });
    expect(result.success).toBe(false);
  });

  it("accepts setting ageEstimateMonths together with birthDate: null (clearing in the same patch)", () => {
    const result = updatePetSchema.safeParse({ ageEstimateMonths: 6, birthDate: null });
    expect(result.success).toBe(true);
  });
});

describe("petSchema", () => {
  it("parses a full valid pet resource", () => {
    const pet = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      householdId: "223e4567-e89b-12d3-a456-426614174000",
      species: "CAT",
      sex: "FEMALE",
      name: "Whiskers",
      neutered: true,
      breedSlug: null,
      birthDate: null,
      ageEstimateMonths: 24,
      weightGrams: 4200,
      photoKey: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    expect(petSchema.safeParse(pet).success).toBe(true);
  });

  it("has no deletedAt field in the public shape", () => {
    expect(petSchema.shape).not.toHaveProperty("deletedAt");
  });
});
