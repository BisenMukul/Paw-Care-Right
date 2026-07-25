import { ABUSE_KEY_PREFIX } from "./abuse.constants";
import { checksPerHourKey, hourBucket } from "./abuse.util";

describe("hourBucket", () => {
  it("is UTC and zero-padded, one bucket per calendar hour", () => {
    expect(hourBucket(new Date("2026-07-25T04:59:59.000Z"))).toBe("2026-07-25T04");
    expect(hourBucket(new Date("2026-07-25T05:00:00.000Z"))).toBe("2026-07-25T05");
  });

  it("zero-pads single-digit month/day/hour", () => {
    expect(hourBucket(new Date("2026-01-05T03:00:00.000Z"))).toBe("2026-01-05T03");
  });
});

describe("checksPerHourKey", () => {
  it("is prefixed and bucketed by userId + hour", () => {
    const now = new Date("2026-07-25T04:59:59.000Z");
    expect(checksPerHourKey("user-1", now)).toBe(`${ABUSE_KEY_PREFIX}checks:hour:user-1:2026-07-25T04`);
  });

  it("distinct users in the same hour get distinct keys", () => {
    const now = new Date("2026-07-25T04:00:00.000Z");
    expect(checksPerHourKey("user-a", now)).not.toBe(checksPerHourKey("user-b", now));
  });
});
