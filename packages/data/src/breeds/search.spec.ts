import { levenshtein, normalize, searchBreeds } from "./search";
import { dogBreeds } from "./index";

describe("normalize", () => {
  it("strips accents, lowercases, and collapses punctuation to single spaces", () => {
    expect(normalize("  Épagneul-Français  ")).toBe("epagneul francais");
  });
});

describe("levenshtein", () => {
  it("is 0 for identical strings", () => {
    expect(levenshtein("beagle", "beagle")).toBe(0);
  });

  it("is 1 for a single substitution", () => {
    expect(levenshtein("beagle", "beagoe")).toBe(1);
  });
});

describe("searchBreeds — gsd (initials) case", () => {
  it("ranks German Shepherd Dog first for the initials query 'gsd'", () => {
    const results = searchBreeds("DOG", "gsd");
    expect(results[0]?.slug).toBe("german-shepherd");
  });
});

describe("searchBreeds — prefix", () => {
  it("whole-name prefix 'germ' includes german-shepherd", () => {
    const results = searchBreeds("DOG", "germ");
    expect(results.some((b) => b.slug === "german-shepherd")).toBe(true);
  });

  it("token-prefix 'shep' includes german-shepherd", () => {
    const results = searchBreeds("DOG", "shep");
    expect(results.some((b) => b.slug === "german-shepherd")).toBe(true);
  });
});

describe("searchBreeds — substring", () => {
  it("a substring that is not a name/token prefix still matches ('epherd')", () => {
    const results = searchBreeds("DOG", "epherd");
    expect(results.some((b) => b.slug === "german-shepherd")).toBe(true);
  });
});

describe("searchBreeds — fuzzy (levenshtein) typo tolerance", () => {
  it("a 1-char typo of Beagle still returns it", () => {
    const results = searchBreeds("DOG", "beagoe");
    expect(results.some((b) => b.slug === "beagle")).toBe(true);
  });
});

describe("searchBreeds — empty query", () => {
  it("returns the full species pool, sorted A→Z, uncapped", () => {
    const results = searchBreeds("DOG", "");
    expect(results.length).toBe(dogBreeds.length);
    const names = results.map((b) => b.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });
});

describe("searchBreeds — cap", () => {
  it("caps non-empty result sets at 20", () => {
    const results = searchBreeds("DOG", "e");
    expect(results.length).toBeLessThanOrEqual(20);
  });
});

describe("searchBreeds — no match", () => {
  it("returns [] for unrecognizable gibberish", () => {
    const results = searchBreeds("DOG", "zzzqqqxxxwww");
    expect(results).toEqual([]);
  });
});
