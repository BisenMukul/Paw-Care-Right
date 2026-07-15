import { validateNoteForm, validateVetVisitForm } from "../src/health-logs/health-log-forms";

// T066 plan "Tests to write" — AC "forms validate via shared schemas".
// Exercises the REAL `@pawcareright/types` schemas, no mocks.

describe("validateNoteForm", () => {
  it("accepts non-empty text and trims it", () => {
    expect(validateNoteForm("hi")).toEqual({ ok: true, value: { text: "hi" } });
    expect(validateNoteForm("  hi  ")).toEqual({ ok: true, value: { text: "hi" } });
  });

  it("rejects empty or whitespace-only text", () => {
    expect(validateNoteForm("")).toEqual({ ok: false, error: "empty" });
    expect(validateNoteForm("   ")).toEqual({ ok: false, error: "empty" });
  });

  it("rejects text over the 2000-char max", () => {
    const tooLong = "a".repeat(2001);
    expect(validateNoteForm(tooLong)).toEqual({ ok: false, error: "tooLong" });
  });

  it("accepts exactly 2000 chars", () => {
    const atMax = "a".repeat(2000);
    expect(validateNoteForm(atMax)).toEqual({ ok: true, value: { text: atMax } });
  });
});

describe("validateVetVisitForm", () => {
  it("omits empty optionals rather than sending empty strings", () => {
    expect(validateVetVisitForm({ reason: "checkup", clinicName: "", notes: "" })).toEqual({
      ok: true,
      value: { reason: "checkup" },
    });
  });

  it("rejects empty or whitespace-only reason", () => {
    expect(validateVetVisitForm({ reason: "", clinicName: "", notes: "" })).toEqual({
      ok: false,
      errors: { reason: "empty" },
    });
    expect(validateVetVisitForm({ reason: "   ", clinicName: "", notes: "" })).toEqual({
      ok: false,
      errors: { reason: "empty" },
    });
  });

  it("rejects a reason over 280 chars", () => {
    const tooLong = "a".repeat(281);
    expect(validateVetVisitForm({ reason: tooLong, clinicName: "", notes: "" })).toEqual({
      ok: false,
      errors: { reason: "tooLong" },
    });
  });

  it("rejects notes over 2000 chars", () => {
    const tooLongNotes = "a".repeat(2001);
    expect(validateVetVisitForm({ reason: "checkup", clinicName: "", notes: tooLongNotes })).toEqual({
      ok: false,
      errors: { notes: "tooLong" },
    });
  });

  it("round-trips a valid clinicName and notes into value", () => {
    expect(
      validateVetVisitForm({ reason: "checkup", clinicName: "Maple Vet", notes: "All good" }),
    ).toEqual({
      ok: true,
      value: { reason: "checkup", clinicName: "Maple Vet", notes: "All good" },
    });
  });

  it("never includes costMicroUsd in the resulting value", () => {
    const result = validateVetVisitForm({ reason: "checkup", clinicName: "", notes: "" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).not.toHaveProperty("costMicroUsd");
    }
  });
});
