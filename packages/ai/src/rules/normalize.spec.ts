import { evaluateRedFlags } from "./engine";
import { containsAnyPhrase, containsPhrase, normalizeText } from "./normalize";

describe("normalizeText", () => {
  it("lowercases the input (case-insensitivity)", () => {
    expect(normalizeText("STRAINING")).toBe("straining");
  });

  it("strips diacritics (straíning -> straining)", () => {
    expect(normalizeText("straíning")).toBe("straining");
  });

  it("strips diacritics (vómito -> vomito)", () => {
    expect(normalizeText("vómito")).toBe("vomito");
  });

  it("replaces punctuation with a space (can't pee! -> cant pee)", () => {
    expect(normalizeText("can't pee!")).toBe("cant pee");
  });

  it("removes apostrophes so can't reaches the same normalized form as cant", () => {
    expect(normalizeText("can't")).toBe("cant");
    expect(normalizeText("cannot")).toBe("cannot");
  });

  it("collapses tabs/newlines/multiple spaces into single spaces", () => {
    expect(normalizeText("cant\tpee\n\n  now")).toBe("cant pee now");
  });

  it("trims leading/trailing whitespace", () => {
    expect(normalizeText("   cant pee   ")).toBe("cant pee");
  });

  it("returns an empty string for empty input", () => {
    expect(normalizeText("")).toBe("");
  });

  it("a string with no keyword yields highest === null (negation-free over-trigger boundary, D2)", () => {
    const result = evaluateRedFlags({ species: "DOG", freeText: "breathing normally and eating well" });

    expect(result.highest).toBeNull();
  });
});

describe("containsPhrase / containsAnyPhrase", () => {
  it("containsPhrase finds a substring", () => {
    expect(containsPhrase("cant pee straining", "straining")).toBe(true);
  });

  it("containsPhrase returns false when phrase absent", () => {
    expect(containsPhrase("eating normally", "straining")).toBe(false);
  });

  it("containsAnyPhrase matches when at least one phrase is present", () => {
    expect(containsAnyPhrase("cant pee now", ["straining to pee", "cant pee"])).toBe(true);
  });

  it("containsAnyPhrase returns false for empty normalized text", () => {
    expect(containsAnyPhrase("", ["straining to pee"])).toBe(false);
  });
});
