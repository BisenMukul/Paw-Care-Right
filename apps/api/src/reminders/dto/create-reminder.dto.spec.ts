import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateReminderDto } from "./create-reminder.dto";

const VALID_PAYLOAD = {
  type: "VACCINE",
  title: "Rabies booster",
  rrule: "FREQ=WEEKLY;BYDAY=MO",
  timezone: "Europe/Paris",
  startAt: "2026-08-01T09:00:00.000Z",
};

describe("CreateReminderDto validation (AC2: invalid rrule rejected at the DTO layer)", () => {
  it("accepts a fully valid payload with no errors", async () => {
    const dto = plainToInstance(CreateReminderDto, VALID_PAYLOAD);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects a malformed rrule via the IsRRule constraint", async () => {
    const dto = plainToInstance(CreateReminderDto, { ...VALID_PAYLOAD, rrule: "FREQ=NOPE" });
    const errors = await validate(dto);

    const rruleError = errors.find((error) => error.property === "rrule");
    expect(rruleError).toBeDefined();
    expect(Object.keys(rruleError?.constraints ?? {})).toContain("isRRule");
  });

  it("rejects an empty rrule", async () => {
    const dto = plainToInstance(CreateReminderDto, { ...VALID_PAYLOAD, rrule: "" });
    const errors = await validate(dto);

    const rruleError = errors.find((error) => error.property === "rrule");
    expect(rruleError).toBeDefined();
    expect(Object.keys(rruleError?.constraints ?? {})).toContain("isRRule");
  });

  it("rejects an invalid timezone", async () => {
    const dto = plainToInstance(CreateReminderDto, { ...VALID_PAYLOAD, timezone: "Not/AZone" });
    const errors = await validate(dto);

    const timezoneError = errors.find((error) => error.property === "timezone");
    expect(timezoneError).toBeDefined();
  });

  it("rejects an out-of-set type", async () => {
    const dto = plainToInstance(CreateReminderDto, { ...VALID_PAYLOAD, type: "NOT_A_TYPE" });
    const errors = await validate(dto);

    const typeError = errors.find((error) => error.property === "type");
    expect(typeError).toBeDefined();
  });

  it("rejects a missing title", async () => {
    const withoutTitle: Record<string, unknown> = { ...VALID_PAYLOAD };
    delete withoutTitle.title;
    const dto = plainToInstance(CreateReminderDto, withoutTitle);
    const errors = await validate(dto);

    const titleError = errors.find((error) => error.property === "title");
    expect(titleError).toBeDefined();
  });

  it("rejects a malformed startAt", async () => {
    const dto = plainToInstance(CreateReminderDto, { ...VALID_PAYLOAD, startAt: "not-a-date" });
    const errors = await validate(dto);

    const startAtError = errors.find((error) => error.property === "startAt");
    expect(startAtError).toBeDefined();
  });

  it("accepts an optional medNameAsEntered and rejects one over 120 chars", async () => {
    const okDto = plainToInstance(CreateReminderDto, { ...VALID_PAYLOAD, medNameAsEntered: "Amoxicillin 250mg" });
    expect(await validate(okDto)).toHaveLength(0);

    const tooLongDto = plainToInstance(CreateReminderDto, {
      ...VALID_PAYLOAD,
      medNameAsEntered: "a".repeat(121),
    });
    const errors = await validate(tooLongDto);
    const medNameError = errors.find((error) => error.property === "medNameAsEntered");
    expect(medNameError).toBeDefined();
  });
});
