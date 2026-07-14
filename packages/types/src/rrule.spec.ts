import { RRULE_FREQUENCIES, isValidRRule, parseRRule, rruleSchema } from "./rrule";

describe("RRULE_FREQUENCIES", () => {
  it("has exactly the 4 documented frequencies, in order", () => {
    expect(RRULE_FREQUENCIES).toEqual(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]);
  });
});

describe("parseRRule accepts the documented valid subset", () => {
  it.each([
    "FREQ=DAILY",
    "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE",
    "FREQ=MONTHLY;BYMONTHDAY=31",
    "FREQ=YEARLY",
    "FREQ=DAILY;COUNT=1",
    "FREQ=DAILY;UNTIL=20261231T090000Z",
    "RRULE:FREQ=DAILY",
  ])("accepts %s", (input) => {
    const result = parseRRule(input);
    expect(result.ok).toBe(true);
  });

  it("parses FREQ + INTERVAL + BYDAY into the expected ParsedRRule shape", () => {
    const result = parseRRule("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE");
    expect(result).toEqual({
      ok: true,
      value: { freq: "WEEKLY", interval: 2, byDay: ["MO", "WE"] },
    });
  });

  it("defaults INTERVAL to 1 when absent", () => {
    const result = parseRRule("FREQ=DAILY");
    expect(result).toEqual({ ok: true, value: { freq: "DAILY", interval: 1 } });
  });

  it("tolerates and strips a leading RRULE: prefix", () => {
    const withPrefix = parseRRule("RRULE:FREQ=DAILY");
    const withoutPrefix = parseRRule("FREQ=DAILY");
    expect(withPrefix).toEqual(withoutPrefix);
  });

  it("parses UNTIL into a UTC Date", () => {
    const result = parseRRule("FREQ=DAILY;UNTIL=20261231T090000Z");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.until).toEqual(new Date(Date.UTC(2026, 11, 31, 9, 0, 0)));
    }
  });
});

describe("parseRRule rejects the documented invalid subset", () => {
  it.each([
    "",
    "INTERVAL=2",
    "FREQ=HOURLY",
    "FREQ=DAILY;INTERVAL=0",
    "FREQ=DAILY;INTERVAL=-1",
    "FREQ=WEEKLY;BYDAY=XX",
    "FREQ=MONTHLY;BYMONTHDAY=32",
    "FREQ=DAILY;FOO=1",
    "FREQ=DAILY;FREQ=WEEKLY",
    "FREQ=DAILY;COUNT=1;UNTIL=20261231T090000Z",
  ])("rejects %s", (input) => {
    const result = parseRRule(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(typeof result.reason).toBe("string");
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("rejects whitespace-only input", () => {
    expect(parseRRule("   ").ok).toBe(false);
  });

  it("never throws on malformed input", () => {
    expect(() => parseRRule("=;;;=FREQ")).not.toThrow();
  });
});

describe("isValidRRule", () => {
  it("mirrors parseRRule(...).ok", () => {
    expect(isValidRRule("FREQ=DAILY")).toBe(true);
    expect(isValidRRule("FREQ=NOPE")).toBe(false);
  });
});

describe("rruleSchema", () => {
  it("accepts a valid rrule string", () => {
    expect(rruleSchema.safeParse("FREQ=WEEKLY;BYDAY=MO").success).toBe(true);
  });

  it("rejects an invalid rrule string", () => {
    expect(rruleSchema.safeParse("FREQ=NOPE").success).toBe(false);
  });
});
