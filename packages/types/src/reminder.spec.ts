import { REMINDER_EVENT_STATUSES, REMINDER_TYPES, reminderEventStatusSchema, reminderTypeSchema } from "./reminder";

describe("REMINDER_EVENT_STATUSES", () => {
  it("has exactly the 5 documented statuses, in order", () => {
    expect(REMINDER_EVENT_STATUSES).toEqual(["PENDING", "SENT", "DONE", "SNOOZED", "MISSED"]);
  });
});

describe("reminderEventStatusSchema accepts well-formed input", () => {
  it.each(REMINDER_EVENT_STATUSES)("accepts %s", (status) => {
    expect(reminderEventStatusSchema.parse(status)).toBe(status);
  });
});

describe("reminderEventStatusSchema rejects malformed input", () => {
  it.each(["NOPE", "pending", "", null, undefined, 1])("rejects %p", (value) => {
    expect(reminderEventStatusSchema.safeParse(value).success).toBe(false);
  });
});

describe("REMINDER_TYPES", () => {
  it("has exactly the 7 documented types, in order", () => {
    expect(REMINDER_TYPES).toEqual([
      "VACCINE",
      "PARASITE",
      "MEDICATION",
      "GROOMING",
      "DENTAL",
      "VET_VISIT",
      "CUSTOM",
    ]);
  });
});

describe("reminderTypeSchema accepts well-formed input", () => {
  it.each(REMINDER_TYPES)("accepts %s", (type) => {
    expect(reminderTypeSchema.parse(type)).toBe(type);
  });
});

describe("reminderTypeSchema rejects malformed input", () => {
  it.each(["NOPE", "vaccine", "", null, undefined, 1])("rejects %p", (value) => {
    expect(reminderTypeSchema.safeParse(value).success).toBe(false);
  });
});
