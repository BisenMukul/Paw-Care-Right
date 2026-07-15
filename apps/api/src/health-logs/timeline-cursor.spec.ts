import { decodeCursor, encodeCursor, InvalidCursorError, type TimelineCursor } from "./timeline-cursor";

describe("timeline-cursor", () => {
  describe("roundtrip", () => {
    it.each([0, 1] as const)("encode -> decode is the identity for sourceRank %d", (s) => {
      const cursor: TimelineCursor = { o: "2026-07-15T12:00:00.000Z", s, i: "some-id-123" };

      const encoded = encodeCursor(cursor);
      const decoded = decodeCursor(encoded);

      expect(decoded).toEqual(cursor);
    });

    it("is base64url text (opaque to the caller)", () => {
      const encoded = encodeCursor({ o: "2026-07-15T12:00:00.000Z", s: 0, i: "abc" });
      expect(encoded).not.toContain("{");
      expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe("rejects_garbage", () => {
    it("non-base64-decodable-to-JSON garbage -> InvalidCursorError", () => {
      expect(() => decodeCursor("!!!not valid base64url!!!")).toThrow(InvalidCursorError);
    });

    it("valid base64url of non-JSON text -> InvalidCursorError", () => {
      const notJson = Buffer.from("this is not json", "utf8").toString("base64url");
      expect(() => decodeCursor(notJson)).toThrow(InvalidCursorError);
    });

    it("valid JSON missing a required field -> InvalidCursorError", () => {
      const missingId = Buffer.from(JSON.stringify({ o: "2026-07-15T12:00:00.000Z", s: 0 }), "utf8").toString(
        "base64url",
      );
      expect(() => decodeCursor(missingId)).toThrow(InvalidCursorError);
    });

    it("out-of-set sourceRank -> InvalidCursorError", () => {
      const badRank = Buffer.from(JSON.stringify({ o: "2026-07-15T12:00:00.000Z", s: 2, i: "x" }), "utf8").toString(
        "base64url",
      );
      expect(() => decodeCursor(badRank)).toThrow(InvalidCursorError);
    });

    it("empty string -> InvalidCursorError", () => {
      expect(() => decodeCursor("")).toThrow(InvalidCursorError);
    });
  });

  describe("forward-compat unknown-field tolerance", () => {
    it("an extra unknown field on an otherwise-valid cursor still decodes", () => {
      const withExtra = Buffer.from(
        JSON.stringify({ o: "2026-07-15T12:00:00.000Z", s: 1, i: "abc", futureField: "whatever" }),
        "utf8",
      ).toString("base64url");

      const decoded = decodeCursor(withExtra);

      expect(decoded).toEqual({ o: "2026-07-15T12:00:00.000Z", s: 1, i: "abc" });
    });
  });
});
