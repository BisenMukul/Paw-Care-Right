import {
  agendaEntrySchema,
  agendaResponseSchema,
  completeOccurrenceInputSchema,
  snoozeOccurrenceInputSchema,
} from "./agenda";

const VALID_ENTRY = {
  reminderId: "reminder1",
  petId: "pet1",
  type: "VACCINE",
  title: "Rabies booster",
  dueAt: "2026-08-01T09:00:00.000Z",
  status: "SCHEDULED",
  virtual: true,
};

describe("agendaEntrySchema", () => {
  it("parses a valid virtual entry (status: SCHEDULED)", () => {
    expect(agendaEntrySchema.parse(VALID_ENTRY)).toEqual(VALID_ENTRY);
  });

  it.each(["PENDING", "SENT", "DONE", "SNOOZED", "MISSED"])("accepts a materialized entry with status %s", (status) => {
    const payload = { ...VALID_ENTRY, virtual: false, eventId: "event1", status };
    expect(agendaEntrySchema.parse(payload)).toEqual(payload);
  });

  it("rejects an entry missing dueAt", () => {
    const { reminderId, petId, type, title, status, virtual } = VALID_ENTRY;
    const payload = { reminderId, petId, type, title, status, virtual };
    expect(agendaEntrySchema.safeParse(payload).success).toBe(false);
  });

  it("rejects a non-ISO dueAt", () => {
    const payload = { ...VALID_ENTRY, dueAt: "not-a-date" };
    expect(agendaEntrySchema.safeParse(payload).success).toBe(false);
  });

  it("rejects an unknown status", () => {
    const payload = { ...VALID_ENTRY, status: "BOGUS" };
    expect(agendaEntrySchema.safeParse(payload).success).toBe(false);
  });

  it("a med entry (with medNameAsEntered + medDoseAsEntered) parses (T061)", () => {
    const payload = {
      ...VALID_ENTRY,
      type: "MEDICATION",
      medNameAsEntered: "As prescribed",
      medDoseAsEntered: "As instructed",
    };
    expect(agendaEntrySchema.parse(payload)).toEqual(payload);
  });

  it("a plain entry (medNameAsEntered/medDoseAsEntered absent) still parses (T061)", () => {
    expect(agendaEntrySchema.parse(VALID_ENTRY)).toEqual(VALID_ENTRY);
  });
});

describe("agendaResponseSchema", () => {
  it("parses a valid response", () => {
    const payload = {
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-31T00:00:00.000Z",
      entries: [VALID_ENTRY],
    };
    expect(agendaResponseSchema.parse(payload)).toEqual(payload);
  });

  it("rejects a non-ISO from/to", () => {
    const payload = { from: "2026-08-01", to: "2026-08-31T00:00:00.000Z", entries: [] };
    expect(agendaResponseSchema.safeParse(payload).success).toBe(false);
  });
});

describe("completeOccurrenceInputSchema", () => {
  it("parses a valid input", () => {
    const payload = { dueAt: "2026-08-01T09:00:00.000Z" };
    expect(completeOccurrenceInputSchema.parse(payload)).toEqual(payload);
  });

  it("rejects a non-ISO dueAt", () => {
    expect(completeOccurrenceInputSchema.safeParse({ dueAt: "bad" }).success).toBe(false);
  });
});

describe("snoozeOccurrenceInputSchema", () => {
  it("parses a valid input", () => {
    const payload = { dueAt: "2026-08-01T09:00:00.000Z", snoozeUntil: "2026-08-02T09:00:00.000Z" };
    expect(snoozeOccurrenceInputSchema.parse(payload)).toEqual(payload);
  });

  it("rejects a snooze input missing snoozeUntil", () => {
    const payload = { dueAt: "2026-08-01T09:00:00.000Z" };
    expect(snoozeOccurrenceInputSchema.safeParse(payload).success).toBe(false);
  });
});
