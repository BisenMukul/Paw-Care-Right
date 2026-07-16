import { isHotlinePackStale } from "../src/config/hotline-pack";

describe("isHotlinePackStale", () => {
  it("returns true when the server version is strictly greater than bundled", () => {
    expect(isHotlinePackStale(2, 1)).toBe(true);
  });

  it("returns false when the server version equals bundled", () => {
    expect(isHotlinePackStale(1, 1)).toBe(false);
  });

  it("returns false when the server version is less than bundled", () => {
    expect(isHotlinePackStale(1, 2)).toBe(false);
  });

  it("is NaN-safe: returns false when the server version is NaN", () => {
    expect(isHotlinePackStale(Number.NaN, 1)).toBe(false);
  });

  it("is NaN-safe: returns false when the bundled version is NaN", () => {
    expect(isHotlinePackStale(2, Number.NaN)).toBe(false);
  });

  it("returns false for non-finite values (Infinity)", () => {
    expect(isHotlinePackStale(Infinity, 1)).toBe(false);
  });
});
