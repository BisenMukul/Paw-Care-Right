import { findToxinEntry, normalizeItem, singularize, toxinVerdictFor } from "./normalize";

describe("normalizeItem", () => {
  it("strips accents, lowercases, and collapses punctuation to single spaces", () => {
    expect(normalizeItem("  Café-Crème  ")).toBe("cafe creme");
  });

  it("drops apostrophes rather than turning them into spaces", () => {
    expect(normalizeItem("Devil's Ivy")).toBe("devils ivy");
  });
});

describe("singularize", () => {
  it("strips a simple trailing plural (grapes -> grape)", () => {
    expect(singularize("grapes")).toBe("grape");
  });

  it("strips a trailing plural (onions -> onion)", () => {
    expect(singularize("onions")).toBe("onion");
  });

  it("handles -ies -> -y (lilies -> lily)", () => {
    expect(singularize("lilies")).toBe("lily");
  });

  it("handles -ies -> -y (berries -> berry)", () => {
    expect(singularize("berries")).toBe("berry");
  });

  it("leaves an already-singular word unchanged", () => {
    expect(singularize("chocolate")).toBe("chocolate");
  });

  it("applies per-token across a multi-word string", () => {
    expect(singularize("sugar free gum")).toBe("sugar free gum");
  });
});

describe("findToxinEntry — plurals", () => {
  it("finds the grapes entry via the plural form", () => {
    expect(findToxinEntry("grapes")?.id).toBe("grapes");
  });
});

describe("findToxinEntry — synonyms", () => {
  it("finds chocolate via 'choco'", () => {
    expect(findToxinEntry("choco")?.id).toBe("chocolate");
  });

  it("finds chocolate via 'cocoa'", () => {
    expect(findToxinEntry("cocoa")?.id).toBe("chocolate");
  });

  it("finds grapes via 'raisins'", () => {
    expect(findToxinEntry("raisins")?.id).toBe("grapes");
  });
});

describe("findToxinEntry — misspellings", () => {
  it("finds chocolate via the alias-carried misspelling 'chocolot'", () => {
    expect(findToxinEntry("chocolot")?.id).toBe("chocolate");
  });

  it("finds chocolate via the alias-carried misspelling 'chocalate'", () => {
    expect(findToxinEntry("chocalate")?.id).toBe("chocolate");
  });

  it("finds avocado via the curated-map misspelling 'avacado'", () => {
    expect(findToxinEntry("avacado")?.id).toBe("avocado");
  });
});

describe("findToxinEntry — multi-word aliases", () => {
  it("finds xylitol via 'sugar free gum'", () => {
    expect(findToxinEntry("sugar free gum")?.id).toBe("xylitol");
  });

  it("finds xylitol via 'sugar-free gum' (hyphen normalized to space)", () => {
    expect(findToxinEntry("sugar-free gum")?.id).toBe("xylitol");
  });
});

describe("findToxinEntry — diacritics", () => {
  it("finds cyclamen even with an added accent", () => {
    expect(findToxinEntry("cyclamén")?.id).toBe("cyclamen");
  });
});

describe("findToxinEntry — case and punctuation insensitivity", () => {
  it("finds onion via 'Garlic!' (case + punctuation)", () => {
    expect(findToxinEntry("Garlic!")?.id).toBe("onion");
  });
});

describe("findToxinEntry — miss", () => {
  it("returns undefined for a nonsense token not in the dataset", () => {
    expect(findToxinEntry("zzzqqqnonexistentitem")).toBeUndefined();
  });
});

describe("toxinVerdictFor", () => {
  it("returns the dog verdict for a dataset hit", () => {
    expect(toxinVerdictFor("DOG", "grapes")).toBe("emergency");
  });

  it("returns the cat verdict for a dataset hit", () => {
    expect(toxinVerdictFor("CAT", "grapes")).toBe("toxic");
  });

  it("returns undefined for a miss", () => {
    expect(toxinVerdictFor("DOG", "zzzqqqnonexistentitem")).toBeUndefined();
  });
});
