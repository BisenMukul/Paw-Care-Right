import { notificationPrefsSchema, QUIET_TIME_REGEX, updateNotificationPrefsSchema } from "./notification-prefs";

const VALID_PAYLOAD = {
  disabledTypes: ["VACCINE", "CUSTOM"],
  quietHours: { start: "22:00", end: "07:00", timezone: "America/New_York" },
};

describe("notificationPrefsSchema", () => {
  it("parses a valid payload with a quiet window", () => {
    expect(notificationPrefsSchema.parse(VALID_PAYLOAD)).toEqual(VALID_PAYLOAD);
  });

  it("accepts quietHours: null", () => {
    const payload = { disabledTypes: [], quietHours: null };
    expect(notificationPrefsSchema.parse(payload)).toEqual(payload);
  });

  it.each(["25:00", "7:5", "9:00", "24:00", "12:60"])("rejects a bad HH:mm %p", (bad) => {
    const payload = { ...VALID_PAYLOAD, quietHours: { ...VALID_PAYLOAD.quietHours, start: bad } };
    expect(notificationPrefsSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects an unknown type in disabledTypes", () => {
    const payload = { ...VALID_PAYLOAD, disabledTypes: ["NOT_A_TYPE"] };
    expect(notificationPrefsSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects a missing timezone on a non-null quietHours", () => {
    const payload = { disabledTypes: [], quietHours: { start: "22:00", end: "07:00" } };
    expect(notificationPrefsSchema.safeParse(payload).success).toBe(false);
  });
});

describe("updateNotificationPrefsSchema", () => {
  it("shares the same shape as notificationPrefsSchema", () => {
    expect(updateNotificationPrefsSchema.parse(VALID_PAYLOAD)).toEqual(VALID_PAYLOAD);
  });
});

describe("QUIET_TIME_REGEX", () => {
  it.each(["00:00", "23:59", "07:00", "22:00"])("matches valid HH:mm %p", (value) => {
    expect(QUIET_TIME_REGEX.test(value)).toBe(true);
  });

  it.each(["25:00", "7:5", "24:00", "12:60", ""])("rejects %p", (value) => {
    expect(QUIET_TIME_REGEX.test(value)).toBe(false);
  });
});
