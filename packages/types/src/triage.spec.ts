import {
  CONFIDENCE_LEVELS,
  HOME_CARE_ALLOWED_TIERS,
  parseTriage,
  possibleCauseSchema,
  SAFE_FALLBACK,
  triageResultSchema,
  URGENCY_TIERS,
  type Confidence,
  type TriageResult,
  type Urgency,
} from "./triage";

/** A minimal, schema-valid `TriageResult` for the given tier, respecting
 * rules (a) low-confidence floor and (b) home-care-on-emergency. Used as the
 * base fixture that individual tests mutate. */
function validFixtureFor(tier: Urgency): TriageResult {
  const allowsHomeCare = (HOME_CARE_ALLOWED_TIERS as readonly Urgency[]).includes(tier);
  return {
    urgency: tier,
    confidence: "high",
    summary: "General guidance based on the information provided.",
    possibleCauses: [{ name: "Mild upset stomach", whyItFits: "Reported symptoms are consistent with this." }],
    redFlagsToWatch: ["Repeated vomiting", "Lethargy that worsens"],
    homeCare: allowsHomeCare ? ["Offer small amounts of water"] : [],
    doNot: ["Do not give human medications without veterinary guidance."],
    vetQuestions: ["How long have symptoms been present?"],
    followUpHours: 24,
  };
}

describe("parseTriage rejects malformed inputs", () => {
  it.each([null, undefined, 42, true, []])("rejects non-object primitive %p", (primitive) => {
    expect(parseTriage(primitive).ok).toBe(false);
  });

  it("rejects wrong type per field", () => {
    const base = validFixtureFor("MONITOR");
    const wrongTypeOverrides: Partial<Record<keyof TriageResult, unknown>> = {
      urgency: 123,
      confidence: 123,
      summary: 123,
      possibleCauses: "not-an-array",
      redFlagsToWatch: "not-an-array",
      homeCare: "not-an-array",
      doNot: "not-an-array",
      vetQuestions: "not-an-array",
      followUpHours: "24",
    };

    for (const [field, badValue] of Object.entries(wrongTypeOverrides)) {
      const candidate = { ...base, [field]: badValue };
      const result = parseTriage(candidate);
      expect(result.ok).toBe(false);
    }
  });

  it("parses a valid serialized JSON-string fixture", () => {
    const fixture = validFixtureFor("REASSURE");
    const result = parseTriage(JSON.stringify(fixture));
    expect(result.ok).toBe(true);
  });

  it("fails closed with INVALID_JSON reason on malformed/truncated JSON string", () => {
    const result = parseTriage('{"urgency":');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.startsWith("INVALID_JSON")).toBe(true);
    }
  });
});

describe("parseTriage rejects a missing required key", () => {
  const base = validFixtureFor("VET_SOON");

  it.each(Object.keys(base) as (keyof TriageResult)[])("rejects a fixture missing %s", (key) => {
    const candidate: Record<string, unknown> = { ...base };
    delete candidate[key];

    const result = parseTriage(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues?.some((issue) => issue.path.join(".") === key)).toBe(true);
    }
  });
});

describe("strict schema rejects extra tiers and extra keys", () => {
  it.each(["EMERGENCY", "vet_24h", "URGENT", "ER", ""])("rejects urgency value %p", (badUrgency) => {
    const candidate = { ...validFixtureFor("MONITOR"), urgency: badUrgency };
    expect(parseTriage(candidate).ok).toBe(false);
  });

  it.each(["HIGH", "unknown"])("rejects confidence value %p", (badConfidence) => {
    const candidate = { ...validFixtureFor("MONITOR"), confidence: badConfidence };
    expect(parseTriage(candidate).ok).toBe(false);
  });

  it("rejects an extra key at the top level", () => {
    const candidate = { ...validFixtureFor("MONITOR"), foo: "x" };
    expect(parseTriage(candidate).ok).toBe(false);
  });

  it("rejects an extra key inside a possibleCauses element (strictObject)", () => {
    const candidate = {
      ...validFixtureFor("MONITOR"),
      possibleCauses: [{ name: "n", whyItFits: "w", extra: 1 }],
    };
    expect(parseTriage(candidate).ok).toBe(false);
  });

  it("possibleCauseSchema itself rejects an extra key", () => {
    expect(possibleCauseSchema.safeParse({ name: "n", whyItFits: "w", extra: 1 }).success).toBe(false);
  });
});

describe("arrays and possibleCauses honor defensive caps", () => {
  it("rejects possibleCauses of length 5, accepts length 4", () => {
    const causeOfIndex = (i: number) => ({ name: `cause ${i}`, whyItFits: "fits" });

    const tooMany = {
      ...validFixtureFor("MONITOR"),
      possibleCauses: [0, 1, 2, 3, 4].map(causeOfIndex),
    };
    expect(parseTriage(tooMany).ok).toBe(false);

    const okMany = {
      ...validFixtureFor("MONITOR"),
      possibleCauses: [0, 1, 2, 3].map(causeOfIndex),
    };
    expect(parseTriage(okMany).ok).toBe(true);
  });

  it.each(["redFlagsToWatch", "homeCare", "doNot", "vetQuestions"] as const)(
    "rejects %s with 11 entries",
    (field) => {
      const tier = field === "homeCare" ? "MONITOR" : "VET_SOON";
      const candidate = {
        ...validFixtureFor(tier),
        [field]: Array.from({ length: 11 }, (_, i) => `entry ${i}`),
      };
      expect(parseTriage(candidate).ok).toBe(false);
    },
  );

  it("rejects an over-long summary and an over-long cause name", () => {
    const longSummary = { ...validFixtureFor("MONITOR"), summary: "a".repeat(601) };
    expect(parseTriage(longSummary).ok).toBe(false);

    const longCauseName = {
      ...validFixtureFor("MONITOR"),
      possibleCauses: [{ name: "a".repeat(121), whyItFits: "fits" }],
    };
    expect(parseTriage(longCauseName).ok).toBe(false);
  });

  it.each([0, -1, 1.5, 3000])("rejects followUpHours value %p", (badHours) => {
    const candidate = { ...validFixtureFor("MONITOR"), followUpHours: badHours };
    expect(parseTriage(candidate).ok).toBe(false);
  });

  it.each([24, null])("accepts followUpHours value %p", (okHours) => {
    const candidate = { ...validFixtureFor("MONITOR"), followUpHours: okHours };
    expect(parseTriage(candidate).ok).toBe(true);
  });
});

describe("low confidence must be at least VET_SOON", () => {
  const floorSatisfyingTiers: Urgency[] = ["EMERGENCY_NOW", "VET_24H", "VET_SOON"];
  const floorViolatingTiers: Urgency[] = ["MONITOR", "REASSURE"];

  it.each(floorSatisfyingTiers)("accepts low confidence with %s", (tier) => {
    const candidate = { ...validFixtureFor(tier), confidence: "low" as Confidence };
    const result = parseTriage(candidate);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // REJECT-not-mutate contract: the returned urgency is unchanged, never silently raised.
      expect(result.result.urgency).toBe(tier);
    }
  });

  it.each(floorViolatingTiers)("rejects low confidence with %s", (tier) => {
    const candidate = { ...validFixtureFor(tier), confidence: "low" as Confidence };
    const result = parseTriage(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues?.some((issue) => issue.path.join(".") === "urgency")).toBe(true);
    }
  });

  it.each(floorViolatingTiers)("accepts medium confidence with %s (floor only applies to low)", (tier) => {
    const candidate = { ...validFixtureFor(tier), confidence: "medium" as Confidence };
    expect(parseTriage(candidate).ok).toBe(true);
  });

  it.each(floorViolatingTiers)("accepts high confidence with %s (floor only applies to low)", (tier) => {
    const candidate = { ...validFixtureFor(tier), confidence: "high" as Confidence };
    expect(parseTriage(candidate).ok).toBe(true);
  });
});

describe("home-care forbidden on emergency tiers", () => {
  it.each(["EMERGENCY_NOW", "VET_24H"] as const)("rejects non-empty homeCare on %s", (tier) => {
    const candidate = { ...validFixtureFor(tier), homeCare: ["rest at home"] };
    const result = parseTriage(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues?.some((issue) => issue.path.join(".") === "homeCare")).toBe(true);
    }
  });

  it.each(["EMERGENCY_NOW", "VET_24H"] as const)("accepts empty homeCare on %s", (tier) => {
    const candidate = { ...validFixtureFor(tier), homeCare: [] };
    expect(parseTriage(candidate).ok).toBe(true);
  });

  it.each(HOME_CARE_ALLOWED_TIERS)("accepts non-empty homeCare on allowed tier %s", (tier) => {
    const candidate = { ...validFixtureFor(tier), homeCare: ["offer small sips of water"] };
    expect(parseTriage(candidate).ok).toBe(true);
  });
});

describe("rejects the word diagnosis/diagnose anywhere", () => {
  const injections = ["diagnosis", "Diagnose", "DIAGNOSED"];

  it.each(injections)("rejects %s injected into summary", (word) => {
    const candidate = { ...validFixtureFor("MONITOR"), summary: `Possible ${word} pending.` };
    const result = parseTriage(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues?.some((issue) => issue.path.join(".") === "summary")).toBe(true);
    }
  });

  it.each(injections)("rejects %s injected into a possibleCauses name", (word) => {
    const candidate = {
      ...validFixtureFor("MONITOR"),
      possibleCauses: [{ name: `${word} candidate`, whyItFits: "fits" }],
    };
    const result = parseTriage(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues?.some((issue) => issue.path.join(".") === "possibleCauses.0.name")).toBe(true);
    }
  });

  it.each(injections)("rejects %s injected into a possibleCauses whyItFits", (word) => {
    const candidate = {
      ...validFixtureFor("MONITOR"),
      possibleCauses: [{ name: "candidate", whyItFits: `Because of ${word}.` }],
    };
    const result = parseTriage(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues?.some((issue) => issue.path.join(".") === "possibleCauses.0.whyItFits")).toBe(true);
    }
  });

  it.each(["redFlagsToWatch", "homeCare", "doNot", "vetQuestions"] as const)(
    "rejects diagnosis word injected into %s",
    (field) => {
      const tier = field === "homeCare" ? "MONITOR" : "VET_SOON";
      const candidate = { ...validFixtureFor(tier), [field]: [`This mentions diagnosis`] };
      const result = parseTriage(candidate);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues?.some((issue) => issue.path.join(".") === `${field}.0`)).toBe(true);
      }
    },
  );
});

describe("SAFE_FALLBACK is itself a valid TriageResult and fails safe", () => {
  it("passes triageResultSchema.safeParse", () => {
    expect(triageResultSchema.safeParse(SAFE_FALLBACK).success).toBe(true);
  });

  it("passes parseTriage", () => {
    expect(parseTriage(SAFE_FALLBACK).ok).toBe(true);
  });

  it("has urgency VET_SOON and confidence low", () => {
    expect(SAFE_FALLBACK.urgency).toBe("VET_SOON");
    expect(SAFE_FALLBACK.confidence).toBe("low");
  });

  it("contains no diagnosis/diagnose language in any user-facing string", () => {
    const allStrings = [
      SAFE_FALLBACK.summary,
      ...SAFE_FALLBACK.possibleCauses.flatMap((c) => [c.name, c.whyItFits]),
      ...SAFE_FALLBACK.redFlagsToWatch,
      ...SAFE_FALLBACK.homeCare,
      ...SAFE_FALLBACK.doNot,
      ...SAFE_FALLBACK.vetQuestions,
    ];
    for (const value of allStrings) {
      expect(/diagnos/i.test(value)).toBe(false);
    }
  });

  it("is frozen, including its nested arrays, and rejects mutation", () => {
    expect(Object.isFrozen(SAFE_FALLBACK)).toBe(true);
    expect(Object.isFrozen(SAFE_FALLBACK.doNot)).toBe(true);
    expect(Object.isFrozen(SAFE_FALLBACK.possibleCauses)).toBe(true);

    expect(() => {
      (SAFE_FALLBACK as { urgency: string }).urgency = "REASSURE";
    }).toThrow();
    expect(SAFE_FALLBACK.urgency).toBe("VET_SOON");

    expect(() => {
      (SAFE_FALLBACK.doNot as string[]).push("something else");
    }).toThrow();
    expect(SAFE_FALLBACK.doNot).toHaveLength(1);
  });
});

describe("parseTriage never throws on hostile input", () => {
  it("does not throw on exotic input shapes", () => {
    const withSymbolKey: Record<string | symbol, unknown> = { [Symbol("k")]: "v" };
    const deeplyNested: { a?: unknown } = {};
    let cursor = deeplyNested;
    for (let i = 0; i < 200; i += 1) {
      cursor.a = {};
      cursor = cursor.a as { a?: unknown };
    }

    const hostileInputs: unknown[] = [10n, withSymbolKey, deeplyNested, new Date(), new Map(), new Set([1, 2])];

    for (const input of hostileInputs) {
      expect(() => parseTriage(input)).not.toThrow();
    }
  });
});

describe("accepts a well-formed result for every tier", () => {
  it.each(URGENCY_TIERS)("accepts a valid fixture for %s", (tier) => {
    expect(parseTriage(validFixtureFor(tier)).ok).toBe(true);
  });
});

describe("URGENCY_TIERS and CONFIDENCE_LEVELS enums", () => {
  it("URGENCY_TIERS has exactly the 5 documented tiers", () => {
    expect(URGENCY_TIERS).toEqual(["EMERGENCY_NOW", "VET_24H", "VET_SOON", "MONITOR", "REASSURE"]);
  });

  it("CONFIDENCE_LEVELS has exactly the 3 documented levels", () => {
    expect(CONFIDENCE_LEVELS).toEqual(["high", "medium", "low"]);
  });
});
