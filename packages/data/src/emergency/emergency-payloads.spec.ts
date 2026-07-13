import { emergencyPayloadSchema } from "./schema";
import { EMERGENCY_PAYLOADS, GENERIC_EMERGENCY_PAYLOAD, resolveEmergencyPayload } from "./index";

describe("emergency payload dataset — resolution", () => {
  it("resolves a known key to its specific payload", () => {
    const payload = resolveEmergencyPayload("gdv-suspected");
    expect(payload.key).toBe("gdv-suspected");
    expect(payload.title).toBe("Possible bloat — get to a vet now");
  });

  it("resolves an undefined key to the generic payload (fail-upward)", () => {
    expect(resolveEmergencyPayload(undefined)).toBe(GENERIC_EMERGENCY_PAYLOAD);
  });

  it("resolves an unknown key to the generic payload (fail-upward)", () => {
    expect(resolveEmergencyPayload("no-such-key")).toBe(GENERIC_EMERGENCY_PAYLOAD);
  });
});

describe("emergency payload dataset — integrity", () => {
  it("has exactly 22 rows", () => {
    expect(EMERGENCY_PAYLOADS.length).toBe(22);
  });

  it("every row parses under emergencyPayloadSchema", () => {
    expect(() => emergencyPayloadSchema.array().parse(EMERGENCY_PAYLOADS)).not.toThrow();
  });

  it("every key is unique and kebab-case", () => {
    const keys = EMERGENCY_PAYLOADS.map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(key).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it("every title/detected/guidance is non-empty", () => {
    for (const row of EMERGENCY_PAYLOADS) {
      expect(row.title.length).toBeGreaterThan(0);
      expect(row.detected.length).toBeGreaterThan(0);
      expect(row.guidance.length).toBeGreaterThan(0);
    }
  });

  it("the generic payload has key 'generic-emergency' and is NOT in EMERGENCY_PAYLOADS", () => {
    expect(GENERIC_EMERGENCY_PAYLOAD.key).toBe("generic-emergency");
    expect(EMERGENCY_PAYLOADS.some((row) => row.key === "generic-emergency")).toBe(false);
  });
});

describe("emergency payload dataset — §7 safety scan (dosing/diagnosis/soft-language)", () => {
  const DIAGNOSIS_WORD_PATTERN = /diagnos/i;
  const NUMERIC_UNIT_DOSING_PATTERN = /\b\d+(\.\d+)?\s*(mg|ml|mcg|g|kg|iu|tsp|tbsp)\b/i;
  const MG_PER_KG_PATTERN = /mg\s*\/\s*kg/i;
  const PER_BODYWEIGHT_PATTERN = /per\s+(kg|pound|lb)\b/i;
  const WAIT_AND_SEE_PATTERN = /\bwait and see\b|\bwait to see\b/i;

  const ALL_ROWS = [...EMERGENCY_PAYLOADS, GENERIC_EMERGENCY_PAYLOAD];

  it("no title/detected/guidance contains diagnosis language", () => {
    const offenders: string[] = [];
    for (const row of ALL_ROWS) {
      for (const field of ["title", "detected", "guidance"] as const) {
        if (DIAGNOSIS_WORD_PATTERN.test(row[field])) {
          offenders.push(`${row.key}.${field}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no title/detected/guidance contains a dosing amount/unit", () => {
    const offenders: string[] = [];
    for (const row of ALL_ROWS) {
      for (const field of ["title", "detected", "guidance"] as const) {
        const value = row[field];
        if (
          NUMERIC_UNIT_DOSING_PATTERN.test(value) ||
          MG_PER_KG_PATTERN.test(value) ||
          PER_BODYWEIGHT_PATTERN.test(value)
        ) {
          offenders.push(`${row.key}.${field}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no title/detected/guidance says 'wait and see' / 'wait to see'", () => {
    const offenders: string[] = [];
    for (const row of ALL_ROWS) {
      for (const field of ["title", "detected", "guidance"] as const) {
        if (WAIT_AND_SEE_PATTERN.test(row[field])) {
          offenders.push(`${row.key}.${field}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
