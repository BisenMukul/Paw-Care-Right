import {
  HEALTH_LOG_KINDS,
  healthLogKindSchema,
  weightValueSchema,
  mealValueSchema,
  noteValueSchema,
  vetVisitValueSchema,
  medGivenValueSchema,
  checkRefValueSchema,
  parseHealthLogValue,
} from "./health-log";

describe("healthLogKindSchema", () => {
  it("accepts all six ARCHITECTURE §3 kinds", () => {
    for (const kind of HEALTH_LOG_KINDS) {
      expect(healthLogKindSchema.safeParse(kind).success).toBe(true);
    }
  });

  it("rejects an unknown kind", () => {
    expect(healthLogKindSchema.safeParse("SOMETHING_ELSE").success).toBe(false);
  });

  it("mirrors the Prisma enum order", () => {
    expect(HEALTH_LOG_KINDS).toEqual(["WEIGHT", "MEAL", "NOTE", "VET_VISIT", "MED_GIVEN", "CHECK_REF"]);
  });
});

describe("weightValueSchema (WEIGHT)", () => {
  it("accepts a positive integer weightGrams", () => {
    expect(weightValueSchema.safeParse({ weightGrams: 4200 }).success).toBe(true);
  });

  it("rejects weightGrams: 0", () => {
    expect(weightValueSchema.safeParse({ weightGrams: 0 }).success).toBe(false);
  });

  it("rejects a negative weightGrams", () => {
    expect(weightValueSchema.safeParse({ weightGrams: -100 }).success).toBe(false);
  });

  it("rejects a float weightGrams (1.5)", () => {
    expect(weightValueSchema.safeParse({ weightGrams: 1.5 }).success).toBe(false);
  });

  it("rejects a missing weightGrams", () => {
    expect(weightValueSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an unknown extra key (strict)", () => {
    expect(weightValueSchema.safeParse({ weightGrams: 4200, extra: "nope" }).success).toBe(false);
  });
});

describe("mealValueSchema (MEAL)", () => {
  it("accepts note only", () => {
    expect(mealValueSchema.safeParse({ note: "Half a cup of kibble" }).success).toBe(true);
  });

  it("accepts note + positive-int portionGrams", () => {
    expect(mealValueSchema.safeParse({ note: "Kibble", portionGrams: 150 }).success).toBe(true);
  });

  it("rejects an empty note", () => {
    expect(mealValueSchema.safeParse({ note: "" }).success).toBe(false);
  });

  it("rejects portionGrams: 0 and a float portionGrams", () => {
    expect(mealValueSchema.safeParse({ note: "Kibble", portionGrams: 0 }).success).toBe(false);
    expect(mealValueSchema.safeParse({ note: "Kibble", portionGrams: 1.5 }).success).toBe(false);
  });
});

describe("noteValueSchema (NOTE)", () => {
  it("accepts text", () => {
    expect(noteValueSchema.safeParse({ text: "Seemed a bit sleepy today" }).success).toBe(true);
  });

  it("rejects empty text", () => {
    expect(noteValueSchema.safeParse({ text: "" }).success).toBe(false);
  });

  it("rejects text over 2000 chars", () => {
    expect(noteValueSchema.safeParse({ text: "a".repeat(2001) }).success).toBe(false);
  });
});

describe("vetVisitValueSchema (VET_VISIT)", () => {
  it("accepts reason plus optional visit fields", () => {
    const payload = {
      reason: "Annual checkup",
      clinicName: "Maple Street Vet",
      notes: "All good",
      costMicroUsd: 50_000_000,
    };
    expect(vetVisitValueSchema.safeParse(payload).success).toBe(true);
  });

  it("rejects a missing reason", () => {
    expect(vetVisitValueSchema.safeParse({ clinicName: "Maple Street Vet" }).success).toBe(false);
  });

  it("rejects an unknown extra key (strict)", () => {
    expect(vetVisitValueSchema.safeParse({ reason: "Checkup", extra: "nope" }).success).toBe(false);
  });
});

describe("medGivenValueSchema (MED_GIVEN)", () => {
  it("accepts reminderEventId with optional as-entered name/dose", () => {
    const payload = {
      reminderEventId: "event-1",
      medNameAsEntered: "As prescribed",
      medDoseAsEntered: "As instructed",
    };
    expect(medGivenValueSchema.safeParse(payload).success).toBe(true);
  });

  it("rejects a missing reminderEventId", () => {
    expect(medGivenValueSchema.safeParse({ medNameAsEntered: "As prescribed" }).success).toBe(false);
  });
});

describe("checkRefValueSchema (CHECK_REF)", () => {
  const VALID_CHECK_ID = "11111111-1111-4111-8111-111111111111";

  it("accepts a valid checkId backlink", () => {
    expect(checkRefValueSchema.safeParse({ checkId: VALID_CHECK_ID }).success).toBe(true);
  });

  it("rejects a missing checkId", () => {
    expect(checkRefValueSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a non-string checkId", () => {
    expect(checkRefValueSchema.safeParse({ checkId: 12345 }).success).toBe(false);
  });
});

describe("parseHealthLogValue", () => {
  const VALID_CHECK_ID = "11111111-1111-4111-8111-111111111111";

  const VALID_PAYLOADS: Record<string, unknown> = {
    WEIGHT: { weightGrams: 4200 },
    MEAL: { note: "Kibble" },
    NOTE: { text: "Seemed a bit sleepy today" },
    VET_VISIT: { reason: "Annual checkup" },
    MED_GIVEN: { reminderEventId: "event-1" },
    CHECK_REF: { checkId: VALID_CHECK_ID },
  };

  it("returns ok for each kind's valid payload", () => {
    for (const [kind, payload] of Object.entries(VALID_PAYLOADS)) {
      expect(parseHealthLogValue(kind, payload)).toMatchObject({ ok: true });
    }
  });

  it("fails closed on an unknown kind", () => {
    const result = parseHealthLogValue("NOT_A_KIND", { anything: true });
    expect(result.ok).toBe(false);
  });

  it("fails closed on an invalid JSON string", () => {
    const result = parseHealthLogValue("WEIGHT", "{not-json");
    expect(result.ok).toBe(false);
  });

  it("never throws on arbitrary garbage", () => {
    const garbageInputs: unknown[] = [null, undefined, 42, true, [], () => {}, Symbol("x"), new Date()];
    for (const garbage of garbageInputs) {
      expect(() => parseHealthLogValue("WEIGHT", garbage)).not.toThrow();
      expect(() => parseHealthLogValue("NOTE", garbage)).not.toThrow();
    }
  });

  it("rejects a payload valid for a DIFFERENT kind", () => {
    const result = parseHealthLogValue("NOTE", { weightGrams: 4200 });
    expect(result.ok).toBe(false);
  });

  it("accepts a JSON-string input and an already-parsed object identically", () => {
    const payload = { weightGrams: 4200 };
    const fromObject = parseHealthLogValue("WEIGHT", payload);
    const fromString = parseHealthLogValue("WEIGHT", JSON.stringify(payload));
    expect(fromObject).toEqual(fromString);
  });
});

describe("safety — no valueJson validator requires or accepts a suggested drug/dose field", () => {
  it("VET_VISIT has no med/dose field", () => {
    const withMed = { reason: "Checkup", medication: "some drug", dose: "5mg" };
    expect(vetVisitValueSchema.safeParse(withMed).success).toBe(false);
  });

  it("MED_GIVEN's name/dose are OPTIONAL free-text records (record-only, never required/suggested)", () => {
    // No name/dose at all is still valid -- nothing is required or computed.
    expect(medGivenValueSchema.safeParse({ reminderEventId: "event-1" }).success).toBe(true);
  });
});
