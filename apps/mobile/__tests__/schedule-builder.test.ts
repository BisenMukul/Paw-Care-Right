import { isValidRRule } from "@pawcareright/types";

import { buildRRule, parseRRuleToScheduleConfig, type ScheduleConfig } from "../src/reminders/schedule-builder";

/**
 * T060 plan AC2: `buildRRule` outputs a valid rrule for daily/weekly/
 * monthly/every-N cases, asserted BOTH on the exact string (matching the
 * plan's grammar table verbatim) and via `isValidRRule` (imported from
 * `@pawcareright/types`, the same validator the api's DTO/service use).
 */
describe("buildRRule (AC2)", () => {
  it.each<[string, ScheduleConfig, string]>([
    ["daily", { freq: "DAILY" }, "FREQ=DAILY"],
    ["every-3-days", { freq: "DAILY", interval: 3 }, "FREQ=DAILY;INTERVAL=3"],
    ["weekly MO,WE", { freq: "WEEKLY", byDay: ["MO", "WE"] }, "FREQ=WEEKLY;BYDAY=MO,WE"],
    [
      "every-2-weeks TU",
      { freq: "WEEKLY", interval: 2, byDay: ["TU"] },
      "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU",
    ],
    ["monthly day-15", { freq: "MONTHLY", byMonthDay: 15 }, "FREQ=MONTHLY;BYMONTHDAY=15"],
    [
      "every-3-months day-1",
      { freq: "MONTHLY", interval: 3, byMonthDay: 1 },
      "FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=1",
    ],
  ])("%s -> %s", (_label, config, expected) => {
    const output = buildRRule(config);
    expect(output).toBe(expected);
    expect(isValidRRule(output)).toBe(true);
  });

  it("interval of 1 (explicit) omits INTERVAL, same as omitted", () => {
    expect(buildRRule({ freq: "DAILY", interval: 1 })).toBe("FREQ=DAILY");
  });

  it("WEEKLY with no byDay omits BYDAY", () => {
    const output = buildRRule({ freq: "WEEKLY" });
    expect(output).toBe("FREQ=WEEKLY");
    expect(isValidRRule(output)).toBe(true);
  });

  it("MONTHLY with no byMonthDay omits BYMONTHDAY", () => {
    const output = buildRRule({ freq: "MONTHLY" });
    expect(output).toBe("FREQ=MONTHLY");
    expect(isValidRRule(output)).toBe(true);
  });

  it("byDay on a non-WEEKLY freq is ignored (freq-scoped field)", () => {
    const output = buildRRule({ freq: "DAILY", byDay: ["MO"] });
    expect(output).toBe("FREQ=DAILY");
  });

  it("byMonthDay on a non-MONTHLY freq is ignored (freq-scoped field)", () => {
    const output = buildRRule({ freq: "WEEKLY", byMonthDay: 5 });
    expect(output).toBe("FREQ=WEEKLY");
  });
});

/** Edit-mode form seeding (bugfix): `parseRRuleToScheduleConfig` is the exact inverse of `buildRRule` for every AC2 case. */
describe("parseRRuleToScheduleConfig", () => {
  it.each<[string, string, ScheduleConfig]>([
    ["FREQ=DAILY", "FREQ=DAILY", { freq: "DAILY", interval: 1 }],
    ["FREQ=DAILY;INTERVAL=3", "FREQ=DAILY;INTERVAL=3", { freq: "DAILY", interval: 3 }],
    ["FREQ=WEEKLY;BYDAY=MO,WE", "FREQ=WEEKLY;BYDAY=MO,WE", { freq: "WEEKLY", interval: 1, byDay: ["MO", "WE"] }],
    [
      "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU",
      "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU",
      { freq: "WEEKLY", interval: 2, byDay: ["TU"] },
    ],
    ["FREQ=MONTHLY;BYMONTHDAY=15", "FREQ=MONTHLY;BYMONTHDAY=15", { freq: "MONTHLY", interval: 1, byMonthDay: 15 }],
    [
      "FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=1",
      "FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=1",
      { freq: "MONTHLY", interval: 3, byMonthDay: 1 },
    ],
  ])("%s -> config, and re-building it round-trips", (_label, rrule, expected) => {
    const config = parseRRuleToScheduleConfig(rrule);
    expect(config).toEqual(expected);
    expect(buildRRule(config)).toBe(rrule);
  });

  it("an out-of-scope freq (YEARLY, e.g. a care-template reminder) degrades to a safe DAILY/interval-1 default", () => {
    expect(parseRRuleToScheduleConfig("FREQ=YEARLY")).toEqual({ freq: "DAILY", interval: 1 });
  });

  it("an unparseable rrule degrades to the same safe default rather than throwing", () => {
    expect(parseRRuleToScheduleConfig("NOT_A_RRULE")).toEqual({ freq: "DAILY", interval: 1 });
  });
});
