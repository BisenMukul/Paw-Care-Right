import { toxins } from "@bombaypetcompany/data";

import { allFoodPagePaths, FOOD_PAGE_COUNT, foodItemIds, staticParamsFor } from "./params";
import { SPECIES_SEGMENTS } from "./species";

describe("params — AC1 (build renders all pages)", () => {
  it("generates exactly toxins.length params per species segment", () => {
    for (const segment of SPECIES_SEGMENTS) {
      const params = staticParamsFor(segment);
      expect(params.length).toBe(toxins.length);
    }
  });

  it("allFoodPagePaths length equals toxins.length * 2 and is at least 440", () => {
    const paths = allFoodPagePaths();
    expect(paths.length).toBe(toxins.length * 2);
    expect(FOOD_PAGE_COUNT).toBe(toxins.length * 2);
    expect(paths.length).toBeGreaterThanOrEqual(440);
  });

  it("every generated path matches the expected shape and is unique", () => {
    const paths = allFoodPagePaths();
    for (const path of paths) {
      expect(path).toMatch(/^\/can-(dogs|cats)-eat\/[a-z0-9-]+$/);
    }
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("the params item ids are exactly the set of toxins[].id, for both segments", () => {
    const datasetIds = new Set(foodItemIds());
    expect(datasetIds.size).toBe(toxins.length);

    for (const segment of SPECIES_SEGMENTS) {
      const params = staticParamsFor(segment);
      const paramIds = new Set(params.map((p) => p.item));
      expect(paramIds).toEqual(datasetIds);
    }
  });

  it("staticParamsFor returns nothing for an unknown segment", () => {
    expect(staticParamsFor("can-birds-eat" as never)).toEqual([]);
  });
});
