import {
  FOOD_SAFETY_FALLBACK,
  FOOD_VERDICT_SEVERITY,
  FOOD_VERDICTS,
  foodSafetyAnswerSchema,
  parseFoodSafetyAnswer,
} from "./food-safety";

function validAnswer(verdict: (typeof FOOD_VERDICTS)[number] = "caution") {
  return { verdict, note: "This item can upset your pet's stomach in larger amounts." };
}

describe("FOOD_VERDICTS and FOOD_VERDICT_SEVERITY", () => {
  it("has exactly the 4 documented verdicts", () => {
    expect(FOOD_VERDICTS).toEqual(["safe", "caution", "toxic", "emergency"]);
  });

  it("severity strictly increases from safe to emergency", () => {
    expect(FOOD_VERDICT_SEVERITY.safe).toBeLessThan(FOOD_VERDICT_SEVERITY.caution);
    expect(FOOD_VERDICT_SEVERITY.caution).toBeLessThan(FOOD_VERDICT_SEVERITY.toxic);
    expect(FOOD_VERDICT_SEVERITY.toxic).toBeLessThan(FOOD_VERDICT_SEVERITY.emergency);
  });
});

describe("parseFoodSafetyAnswer accepts well-formed input", () => {
  it.each(FOOD_VERDICTS)("accepts a valid object fixture with verdict %s", (verdict) => {
    const result = parseFoodSafetyAnswer(validAnswer(verdict));
    expect(result.ok).toBe(true);
  });

  it("accepts a valid serialized JSON-string fixture", () => {
    const result = parseFoodSafetyAnswer(JSON.stringify(validAnswer("toxic")));
    expect(result.ok).toBe(true);
  });
});

describe("parseFoodSafetyAnswer rejects malformed input", () => {
  it.each([null, undefined, 42, true, []])("rejects non-object primitive %p", (primitive) => {
    expect(parseFoodSafetyAnswer(primitive).ok).toBe(false);
  });

  it("fails closed with INVALID_JSON reason on malformed/truncated JSON string", () => {
    const result = parseFoodSafetyAnswer('{"verdict":');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.startsWith("INVALID_JSON")).toBe(true);
    }
  });

  it("rejects an unknown verdict value", () => {
    const candidate = { ...validAnswer(), verdict: "fine" };
    expect(parseFoodSafetyAnswer(candidate).ok).toBe(false);
  });

  it("rejects an extra key (strictObject)", () => {
    const candidate = { ...validAnswer(), extra: "x" };
    expect(parseFoodSafetyAnswer(candidate).ok).toBe(false);
  });

  it("rejects a missing note", () => {
    const candidate = { verdict: "caution" };
    const result = parseFoodSafetyAnswer(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues?.some((issue) => issue.path.join(".") === "note")).toBe(true);
    }
  });

  it("rejects an over-long note", () => {
    const candidate = { ...validAnswer(), note: "a".repeat(601) };
    expect(parseFoodSafetyAnswer(candidate).ok).toBe(false);
  });

  it("never throws on hostile input", () => {
    const hostileInputs: unknown[] = [10n, new Date(), new Map(), new Set([1, 2]), Symbol("x")];
    for (const input of hostileInputs) {
      expect(() => parseFoodSafetyAnswer(input)).not.toThrow();
    }
  });
});

describe("rejects the word diagnosis/diagnose in note", () => {
  it.each(["diagnosis", "Diagnose", "DIAGNOSED"])("rejects %s injected into note", (word) => {
    const candidate = { ...validAnswer(), note: `Possible ${word} pending.` };
    const result = parseFoodSafetyAnswer(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues?.some((issue) => issue.path.join(".") === "note")).toBe(true);
    }
  });
});

describe("rejects dosing-shaped language in note", () => {
  it.each([
    "Give 200 mg twice daily.",
    "A dose of 5 ml is common.",
    "Toxic at 20 mg/kg in dogs.",
    "Unsafe above 0.1 g per pound of body weight.",
    "Around 50 IU is often cited.",
  ])("rejects %s", (note) => {
    const candidate = { ...validAnswer(), note };
    const result = parseFoodSafetyAnswer(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues?.some((issue) => issue.path.join(".") === "note")).toBe(true);
    }
  });

  it("accepts qualitative severity language with no numbers/units", () => {
    const candidate = {
      ...validAnswer("toxic"),
      note: "Dark and baking varieties are more dangerous than milk versions; larger amounts are more serious.",
    };
    expect(parseFoodSafetyAnswer(candidate).ok).toBe(true);
  });
});

describe("foodSafetyAnswerSchema itself", () => {
  it("rejects an extra key directly", () => {
    expect(foodSafetyAnswerSchema.safeParse({ ...validAnswer(), extra: 1 }).success).toBe(false);
  });
});

describe("FOOD_SAFETY_FALLBACK is itself a valid FoodSafetyAnswer and fails safe", () => {
  it("passes foodSafetyAnswerSchema.safeParse", () => {
    expect(foodSafetyAnswerSchema.safeParse(FOOD_SAFETY_FALLBACK).success).toBe(true);
  });

  it("passes parseFoodSafetyAnswer", () => {
    expect(parseFoodSafetyAnswer(FOOD_SAFETY_FALLBACK).ok).toBe(true);
  });

  it("has verdict caution, never safe", () => {
    expect(FOOD_SAFETY_FALLBACK.verdict).toBe("caution");
    expect(FOOD_SAFETY_FALLBACK.verdict).not.toBe("safe");
  });

  it("contains no diagnosis/diagnose language", () => {
    expect(/diagnos/i.test(FOOD_SAFETY_FALLBACK.note)).toBe(false);
  });

  it("is frozen and rejects mutation", () => {
    expect(Object.isFrozen(FOOD_SAFETY_FALLBACK)).toBe(true);
    expect(() => {
      (FOOD_SAFETY_FALLBACK as { verdict: string }).verdict = "safe";
    }).toThrow();
    expect(FOOD_SAFETY_FALLBACK.verdict).toBe("caution");
  });
});
