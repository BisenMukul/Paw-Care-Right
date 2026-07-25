import { toxins } from "@pawcareright/data";

import { SITE_URL } from "../site";
import { allFoodPagePaths } from "./params";
import {
  buildFoodPageModel,
  metaDescription,
  relatedItems,
  type FoodPageModel,
} from "./page-model";
import { speciesBySegment } from "./species";

describe("buildFoodPageModel — resolution", () => {
  it("returns null for an unknown item id", () => {
    expect(buildFoodPageModel("can-dogs-eat", "not-a-real-item")).toBeNull();
  });

  it("returns null for an unknown segment", () => {
    expect(buildFoodPageModel("can-birds-eat", "grapes")).toBeNull();
  });
});

describe("buildFoodPageModel — verdict matches the dataset (12-pair sample)", () => {
  const samples: Array<{ segment: "can-dogs-eat" | "can-cats-eat"; itemId: string }> = [
    { segment: "can-dogs-eat", itemId: "grapes" },
    { segment: "can-cats-eat", itemId: "true-lilies" },
    { segment: "can-dogs-eat", itemId: "chocolate" },
    { segment: "can-cats-eat", itemId: "onion" },
    { segment: "can-dogs-eat", itemId: "onion" },
    { segment: "can-cats-eat", itemId: "chocolate" },
    { segment: "can-cats-eat", itemId: "xylitol" },
    { segment: "can-dogs-eat", itemId: "true-lilies" },
    { segment: "can-cats-eat", itemId: "grapes" },
    { segment: "can-dogs-eat", itemId: "apple" },
    { segment: "can-cats-eat", itemId: "banana" },
    { segment: "can-dogs-eat", itemId: "watermelon" },
  ];

  it.each(samples)("$segment/$itemId matches the dataset verdict", ({ segment, itemId }) => {
    const row = toxins.find((t) => t.id === itemId);
    expect(row).toBeDefined();
    const species = speciesBySegment(segment);
    expect(species).toBeDefined();
    const expected = row!.verdicts[species!.verdictKey];

    const model = buildFoodPageModel(segment, itemId);
    expect(model).not.toBeNull();
    expect(model!.verdict).toBe(expected);
  });

  it("the dogs page and the cats page differ for species-disagreeing rows", () => {
    for (const itemId of ["grapes", "xylitol", "true-lilies"]) {
      const dogModel = buildFoodPageModel("can-dogs-eat", itemId);
      const catModel = buildFoodPageModel("can-cats-eat", itemId);
      expect(dogModel!.verdict).not.toBe(catModel!.verdict);
    }
  });

  it("at least three sample rows have a safe verdict for at least one species", () => {
    const safeSamples = samples.filter(({ segment, itemId }) => {
      const row = toxins.find((t) => t.id === itemId)!;
      const species = speciesBySegment(segment)!;
      return row.verdicts[species.verdictKey] === "safe";
    });
    expect(safeSamples.length).toBeGreaterThanOrEqual(3);
  });
});

describe("buildFoodPageModel — verbatim dataset pass-through (D8)", () => {
  it("itemName is row.name verbatim", () => {
    const row = toxins.find((t) => t.id === "true-lilies")!;
    const model = buildFoodPageModel("can-cats-eat", "true-lilies")!;
    expect(model.itemName).toBe(row.name);
    expect(model.itemName).toBe("True lilies (Lilium and Hemerocallis)");
  });

  it("note is row.note verbatim, not truncated or rewritten", () => {
    const row = toxins.find((t) => t.id === "chocolate")!;
    const model = buildFoodPageModel("can-dogs-eat", "chocolate")!;
    expect(model.note).toBe(row.note);
  });

  it("quantityNuance is row.quantityNuance verbatim when present", () => {
    const row = toxins.find((t) => t.id === "grapes")!;
    const model = buildFoodPageModel("can-dogs-eat", "grapes")!;
    expect(model.quantityNuance).toBe(row.quantityNuance);
  });
});

describe("buildFoodPageModel — quantityNuance section / FAQ Q2 gating", () => {
  it("appears (quantityNuance field set, 3 FAQ entries incl. Q2) when the row has quantityNuance", () => {
    const model = buildFoodPageModel("can-dogs-eat", "grapes")!;
    expect(model.quantityNuance).toBeDefined();
    expect(model.faq).toHaveLength(3);
    expect(model.faq[1]!.question).toContain("Does the amount of");
    expect(model.faq[1]!.answer).toBe(model.quantityNuance);
  });

  it("does not appear (quantityNuance undefined, 2 FAQ entries) when the row has no quantityNuance", () => {
    const row = toxins.find((t) => t.id === "avocado")!;
    expect(row.quantityNuance).toBeUndefined();
    const model = buildFoodPageModel("can-dogs-eat", "avocado")!;
    expect(model.quantityNuance).toBeUndefined();
    expect(model.faq).toHaveLength(2);
  });
});

describe("buildFoodPageModel — canonicalUrl", () => {
  it("is SITE_URL + '/' + segment + '/' + itemId", () => {
    const model = buildFoodPageModel("can-dogs-eat", "grapes")!;
    expect(model.canonicalUrl).toBe(`${SITE_URL}/can-dogs-eat/grapes`);
  });
});

describe("metaDescription", () => {
  it("never exceeds 155 chars", () => {
    for (const row of toxins) {
      for (const segment of ["can-dogs-eat", "can-cats-eat"] as const) {
        const model = buildFoodPageModel(segment, row.id)!;
        expect(model.description.length).toBeLessThanOrEqual(155);
      }
    }
  });

  it("ends with … only when truncated (long note forces truncation)", () => {
    const shortModel = buildFoodPageModel("can-dogs-eat", "grapes")!;
    const rawShort = `${shortModel.verdictHeadline}. ${shortModel.note}`;
    if (rawShort.length <= 155) {
      expect(shortModel.description.endsWith("…")).toBe(false);
      expect(shortModel.description).toBe(rawShort);
    }

    const longModel = buildFoodPageModel("can-dogs-eat", "antihistamine-diphenhydramine")!;
    const rawLong = `${longModel.verdictHeadline}. ${longModel.note}`;
    expect(rawLong.length).toBeGreaterThan(155);
    expect(longModel.description.endsWith("…")).toBe(true);
    expect(longModel.description.length).toBeLessThanOrEqual(155);
  });

  it("is idempotent (same output truncated does not shrink further)", () => {
    const input = {
      verdictHeadline: "Dangerous for dogs — treat this as an emergency",
      note: "Diphenhydramine antihistamine".repeat(10),
    };
    const first = metaDescription(input);
    const second = metaDescription({ verdictHeadline: "", note: first.replace(/^\. /, "") });
    expect(second.length).toBeLessThanOrEqual(first.length + 3);
  });
});

describe("relatedItems", () => {
  const allPaths = new Set(allFoodPagePaths());

  it("is deterministic, ≤6 entries, excludes the page's own item, shares its category", () => {
    const row = toxins.find((t) => t.id === "grapes")!;
    const first = relatedItems(row, "can-dogs-eat");
    const second = relatedItems(row, "can-dogs-eat");
    expect(second).toEqual(first);
    expect(first.length).toBeLessThanOrEqual(6);
    expect(first.some((link) => link.href.endsWith("/grapes"))).toBe(false);

    for (const link of first) {
      expect(allPaths.has(link.href)).toBe(true);
    }
  });

  it("every relatedItems href resolves to a generated path, for every row", () => {
    for (const row of toxins) {
      const links = relatedItems(row, "can-cats-eat");
      for (const link of links) {
        expect(allPaths.has(link.href)).toBe(true);
      }
    }
  });
});

describe("otherSpecies cross-link", () => {
  it("points at the same item under the other segment (both directions)", () => {
    const dogModel = buildFoodPageModel("can-dogs-eat", "onion")!;
    expect(dogModel.otherSpecies.href).toBe("/can-cats-eat/onion");

    const catModel = buildFoodPageModel("can-cats-eat", "onion")!;
    expect(catModel.otherSpecies.href).toBe("/can-dogs-eat/onion");
  });
});

describe("showHotlineCta", () => {
  const verdictToItemId: Record<FoodPageModel["verdict"], string> = {
    safe: "apple",
    caution: "avocado",
    toxic: "onion",
    emergency: "grapes",
  };

  it.each(Object.entries(verdictToItemId))(
    "is true exactly for toxic/emergency (verdict=%s)",
    (verdict, itemId) => {
      const row = toxins.find((t) => t.id === itemId)!;
      const segment = row.verdicts.dog === verdict ? "can-dogs-eat" : "can-cats-eat";
      const model = buildFoodPageModel(segment, itemId)!;
      expect(model.verdict).toBe(verdict);
      expect(model.showHotlineCta).toBe(verdict === "toxic" || verdict === "emergency");
    },
  );
});
