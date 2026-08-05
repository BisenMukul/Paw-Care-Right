import {
  decideReview,
  EMERGENCY_SUPPRESSION_MS,
  hasMissedEntry,
  nextStreak,
  REVIEW_STREAK_THRESHOLD,
  REVIEW_THROTTLE_MS,
  type ReviewGateState,
} from "../src/review/review-trigger";

// T109: pure trigger-logic AC (card: "Trigger-logic unit tests incl.
// suppression cases"). No storage/native/react mocking needed -- every
// input is a plain object.

const NOW = 1_700_000_000_000; // fixed epoch ms
const DAY_MS = 24 * 60 * 60 * 1000;

function state(overrides: Partial<ReviewGateState> = {}): ReviewGateState {
  return { lastPromptedAt: null, lastEmergencyAt: null, completionStreak: 0, ...overrides };
}

describe("review-trigger", () => {
  it("AC1.1: requests on an acknowledged REASSURE result when never prompted and no emergency", () => {
    expect(
      decideReview({ now: NOW, moment: "reassure-acknowledged", state: state() }),
    ).toBe("request");
  });

  it("AC1.2: requests on the 5th consecutive reminder completion (and every multiple of 5)", () => {
    for (const streak of [5, 10, 15]) {
      expect(
        decideReview({ now: NOW, moment: "reminder-streak", state: state({ completionStreak: streak }) }),
      ).toBe("request");
    }
  });

  it("AC1.3: suppresses the streak moment below the 5th completion", () => {
    for (const streak of [0, 1, 2, 3, 4]) {
      expect(
        decideReview({ now: NOW, moment: "reminder-streak", state: state({ completionStreak: streak }) }),
      ).toBe("suppressed-streak");
    }
  });

  it("AC1.4: suppresses when a prompt was shown less than 60 days ago, requests at the boundary", () => {
    expect(
      decideReview({
        now: NOW,
        moment: "reassure-acknowledged",
        state: state({ lastPromptedAt: NOW - 59 * DAY_MS }),
      }),
    ).toBe("suppressed-throttle");

    expect(
      decideReview({
        now: NOW,
        moment: "reassure-acknowledged",
        state: state({ lastPromptedAt: NOW - 60 * DAY_MS }),
      }),
    ).toBe("request");
  });

  it("AC1.5: suppresses inside the emergency window, clears at the boundary", () => {
    expect(
      decideReview({
        now: NOW,
        moment: "reassure-acknowledged",
        state: state({ lastEmergencyAt: NOW - 29 * DAY_MS }),
      }),
    ).toBe("suppressed-emergency");

    expect(
      decideReview({
        now: NOW,
        moment: "reassure-acknowledged",
        state: state({ lastEmergencyAt: NOW - 30 * DAY_MS }),
      }),
    ).not.toBe("suppressed-emergency");
  });

  it("AC1.6: emergency suppression wins over an otherwise-eligible positive moment", () => {
    expect(
      decideReview({
        now: NOW,
        moment: "reminder-streak",
        state: state({ lastEmergencyAt: NOW - 1 * 60 * 60 * 1000, completionStreak: 5, lastPromptedAt: null }),
      }),
    ).toBe("suppressed-emergency");
  });

  it("AC1.7: suppresses when the clock has moved backwards (throttle, fail-closed)", () => {
    expect(
      decideReview({
        now: NOW,
        moment: "reassure-acknowledged",
        state: state({ lastPromptedAt: NOW + DAY_MS }),
      }),
    ).toBe("suppressed-throttle");
  });

  it("AC1.8: suppresses when the clock has moved backwards (emergency, fail-closed)", () => {
    expect(
      decideReview({
        now: NOW,
        moment: "reassure-acknowledged",
        state: state({ lastEmergencyAt: NOW + DAY_MS }),
      }),
    ).toBe("suppressed-emergency");
  });

  it("AC1.9: the reassure moment never requires a streak", () => {
    expect(
      decideReview({ now: NOW, moment: "reassure-acknowledged", state: state({ completionStreak: 0 }) }),
    ).toBe("request");
  });

  it("AC1.10: nextStreak increments on completion and resets on snooze or miss, never negative", () => {
    expect(nextStreak(4, "completed")).toBe(5);
    expect(nextStreak(7, "snoozed")).toBe(0);
    expect(nextStreak(7, "missed")).toBe(0);
    expect(nextStreak(0, "snoozed")).toBe(0);
    expect(nextStreak(0, "missed")).toBe(0);
  });

  it("AC1.11: hasMissedEntry detects MISSED and ignores every other status", () => {
    expect(hasMissedEntry([{ status: "DONE" }, { status: "SNOOZED" }, { status: "PENDING" }, { status: "SENT" }, { status: "SCHEDULED" }])).toBe(false);
    expect(hasMissedEntry([{ status: "DONE" }, { status: "MISSED" }])).toBe(true);
    expect(hasMissedEntry([])).toBe(false);
  });

  it("AC1.12: the throttle, suppression window and streak threshold equal the documented constants", () => {
    expect(REVIEW_THROTTLE_MS).toBe(60 * DAY_MS);
    expect(EMERGENCY_SUPPRESSION_MS).toBe(30 * DAY_MS);
    expect(REVIEW_STREAK_THRESHOLD).toBe(5);
  });
});
