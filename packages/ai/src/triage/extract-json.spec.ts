import { parseTriage, SAFE_FALLBACK } from "@pawcareright/types";

import { extractJsonCandidate } from "./extract-json";

const VALID_JSON = JSON.stringify(SAFE_FALLBACK);

describe("extractJsonCandidate", () => {
  it("returns plain JSON unchanged", () => {
    expect(extractJsonCandidate(VALID_JSON)).toBe(VALID_JSON);
  });

  it("strips ```json fences", () => {
    expect(extractJsonCandidate("```json\n" + VALID_JSON + "\n```")).toBe(VALID_JSON);
  });

  it("strips bare ``` fences", () => {
    expect(extractJsonCandidate("```\n" + VALID_JSON + "\n```")).toBe(VALID_JSON);
  });

  it("strips uppercase ```JSON fences", () => {
    expect(extractJsonCandidate("```JSON\n" + VALID_JSON + "\n```")).toBe(VALID_JSON);
  });

  it("strips a leading BOM", () => {
    expect(extractJsonCandidate("\uFEFF" + VALID_JSON)).toBe(VALID_JSON);
  });

  it("strips leading prose before the JSON", () => {
    expect(extractJsonCandidate("Here is the JSON:\n" + VALID_JSON)).toBe(VALID_JSON);
  });

  it("strips trailing prose after the JSON", () => {
    expect(extractJsonCandidate(VALID_JSON + "\nHope that helps!")).toBe(VALID_JSON);
  });

  it("returns a trimmed no-brace input unchanged", () => {
    expect(extractJsonCandidate("  not json  ")).toBe("not json");
  });

  it("never throws on an empty string", () => {
    expect(() => extractJsonCandidate("")).not.toThrow();
    expect(extractJsonCandidate("")).toBe("");
  });

  it("round-trips through parseTriage: BOM + fences + leading prose + trailing prose", () => {
    const wrapped = "\uFEFFHere is the JSON:\n```json\n" + VALID_JSON + "\n```\nHope that helps!";
    const result = parseTriage(extractJsonCandidate(wrapped));
    expect(result.ok).toBe(true);
  });
});
