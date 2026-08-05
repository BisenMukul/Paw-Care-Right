import { FEEDBACK_LOG_ENTRIES_MAX } from "@bombaypetcompany/types";

import { __resetLogBufferForTest, getLogEntries, recordLogEvent } from "../src/observability/log-buffer";

const CLOSED_ENTRY_KEYS = new Set(["at", "level", "code", "errorName"]);

describe("log-buffer (T104 D3)", () => {
  beforeEach(() => {
    __resetLogBufferForTest();
  });

  it("starts empty", () => {
    expect(getLogEntries()).toEqual([]);
  });

  it("records an entry with the given level/code and a generated timestamp", () => {
    recordLogEvent({ level: "warn", code: "startup_nonfatal" });

    const entries = getLogEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.level).toBe("warn");
    expect(entries[0]!.code).toBe("startup_nonfatal");
    expect(typeof entries[0]!.at).toBe("string");
    expect(() => new Date(entries[0]!.at).toISOString()).not.toThrow();
  });

  it(`evicts the oldest entry past capacity (${FEEDBACK_LOG_ENTRIES_MAX})`, () => {
    for (let i = 0; i < FEEDBACK_LOG_ENTRIES_MAX + 1; i += 1) {
      recordLogEvent({ level: "error", code: "captured_error", errorName: `Err${i}` });
    }

    const entries = getLogEntries();
    expect(entries).toHaveLength(FEEDBACK_LOG_ENTRIES_MAX);
    // The 0th entry (oldest) was evicted; the buffer now starts at Err1.
    expect(entries[0]!.errorName).toBe("Err1");
    expect(entries[entries.length - 1]!.errorName).toBe(`Err${FEEDBACK_LOG_ENTRIES_MAX}`);
  });

  it("drops a non-conforming errorName containing a space", () => {
    recordLogEvent({ level: "error", code: "captured_error", errorName: "Type Error" });

    const entries = getLogEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.errorName).toBeUndefined();
    expect("errorName" in entries[0]!).toBe(false);
  });

  it("drops a non-conforming errorName containing an @", () => {
    recordLogEvent({ level: "error", code: "captured_error", errorName: "user@example.com" });

    const entries = getLogEntries();
    expect(entries[0]!.errorName).toBeUndefined();
  });

  it("keeps a conforming bare-identifier errorName", () => {
    recordLogEvent({ level: "error", code: "captured_error", errorName: "TypeError" });

    expect(getLogEntries()[0]!.errorName).toBe("TypeError");
  });

  it("every produced entry's keys are within the closed set (no free-text field)", () => {
    recordLogEvent({ level: "error", code: "captured_error", errorName: "TypeError" });
    recordLogEvent({ level: "warn", code: "startup_nonfatal" });
    recordLogEvent({ level: "error", code: "render_error" });
    recordLogEvent({ level: "error", code: "startup_fatal", errorName: "not valid @@" });

    for (const entry of getLogEntries()) {
      for (const key of Object.keys(entry)) {
        expect(CLOSED_ENTRY_KEYS.has(key)).toBe(true);
      }
    }
  });

  it("returns a fresh array copy each call (caller mutation cannot corrupt the buffer)", () => {
    recordLogEvent({ level: "error", code: "captured_error" });

    const first = getLogEntries() as FeedbackLogEntryLike[];
    first.pop();

    expect(getLogEntries()).toHaveLength(1);
  });
});

interface FeedbackLogEntryLike {
  at: string;
  level: string;
  code: string;
}
