import { CHECK_STATUSES, checkStatusSchema } from "./check-status";

describe("CHECK_STATUSES", () => {
  it("has exactly the 4 documented statuses, in order", () => {
    expect(CHECK_STATUSES).toEqual(["QUEUED", "RUNNING", "DONE", "FALLBACK"]);
    expect(CHECK_STATUSES).toHaveLength(4);
  });
});

describe("checkStatusSchema accepts well-formed input", () => {
  it.each(CHECK_STATUSES)("accepts %s", (status) => {
    expect(checkStatusSchema.parse(status)).toBe(status);
  });
});

describe("checkStatusSchema rejects malformed input", () => {
  it.each(["done", "CANCELLED", "", "queued", "running", "Fallback", null, undefined, 1])(
    "rejects %p",
    (value) => {
      expect(checkStatusSchema.safeParse(value).success).toBe(false);
    },
  );
});
