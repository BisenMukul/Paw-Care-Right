import { feedbackLogEntrySchema, submitFeedbackSchema } from "./feedback";

const MINIMAL_VALID_PAYLOAD = {
  category: "BUG",
  message: "The app crashed when I tapped save.",
  platform: "ios",
  appVersion: "1.0.0",
  attachLogs: false,
} as const;

describe("submitFeedbackSchema", () => {
  it("accepts a minimal valid payload", () => {
    expect(() => submitFeedbackSchema.parse(MINIMAL_VALID_PAYLOAD)).not.toThrow();
  });

  it("rejects an unknown key (.strict())", () => {
    expect(() => submitFeedbackSchema.parse({ ...MINIMAL_VALID_PAYLOAD, extra: "nope" })).toThrow();
  });

  it("rejects a message at 2001 chars", () => {
    const tooLong = { ...MINIMAL_VALID_PAYLOAD, message: "a".repeat(2001) };
    expect(() => submitFeedbackSchema.parse(tooLong)).toThrow();
  });

  it("accepts a message at exactly 2000 chars", () => {
    const atLimit = { ...MINIMAL_VALID_PAYLOAD, message: "a".repeat(2000) };
    expect(() => submitFeedbackSchema.parse(atLimit)).not.toThrow();
  });

  it("rejects a 51st log entry", () => {
    const entry = { at: new Date().toISOString(), level: "error", code: "captured_error" };
    const tooManyLogs = {
      ...MINIMAL_VALID_PAYLOAD,
      attachLogs: true,
      logs: Array.from({ length: 51 }, () => entry),
    };
    expect(() => submitFeedbackSchema.parse(tooManyLogs)).toThrow();
  });

  it("accepts exactly 50 log entries when attachLogs is true", () => {
    const entry = { at: new Date().toISOString(), level: "error", code: "captured_error" };
    const atLimit = {
      ...MINIMAL_VALID_PAYLOAD,
      attachLogs: true,
      logs: Array.from({ length: 50 }, () => entry),
    };
    expect(() => submitFeedbackSchema.parse(atLimit)).not.toThrow();
  });

  it("rejects a malformed sentryEventId", () => {
    const badEventId = { ...MINIMAL_VALID_PAYLOAD, sentryEventId: "not-32-hex-chars" };
    expect(() => submitFeedbackSchema.parse(badEventId)).toThrow();
  });

  it("accepts a well-formed sentryEventId (32 lowercase hex)", () => {
    const good = { ...MINIMAL_VALID_PAYLOAD, sentryEventId: "a".repeat(32) };
    expect(() => submitFeedbackSchema.parse(good)).not.toThrow();
  });

  // AC2 (schema): the shared contract itself encodes the consent rule, so a
  // client cannot construct a payload claiming no consent yet carrying logs.
  it("rejects { attachLogs: false, logs: [oneEntry] }", () => {
    const entry = { at: new Date().toISOString(), level: "error", code: "captured_error" };
    const contradictory = { ...MINIMAL_VALID_PAYLOAD, attachLogs: false, logs: [entry] };
    expect(() => submitFeedbackSchema.parse(contradictory)).toThrow();
  });
});

describe("feedbackLogEntrySchema", () => {
  const base = { at: new Date().toISOString(), level: "error" as const, code: "captured_error" as const };

  it("accepts a valid entry without errorName", () => {
    expect(() => feedbackLogEntrySchema.parse(base)).not.toThrow();
  });

  it("accepts a valid entry with a bare-identifier errorName", () => {
    expect(() => feedbackLogEntrySchema.parse({ ...base, errorName: "TypeError" })).not.toThrow();
  });

  it("rejects an errorName containing a space", () => {
    expect(() => feedbackLogEntrySchema.parse({ ...base, errorName: "Type Error" })).toThrow();
  });

  it("rejects an errorName containing an @", () => {
    expect(() => feedbackLogEntrySchema.parse({ ...base, errorName: "user@example.com" })).toThrow();
  });

  it("rejects an unknown key (.strict())", () => {
    expect(() => feedbackLogEntrySchema.parse({ ...base, message: "free text" })).toThrow();
  });
});
