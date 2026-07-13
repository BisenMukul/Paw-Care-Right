import { URGENCY_TIERS, type Urgency } from "@pawcareright/types";

import {
  buildVetSearchQuery,
  buildVetSearchUrl,
  EMERGENCY_VET_QUERY,
  ROUTINE_VET_QUERY,
  VET_SEARCH_MAPS_BASE,
} from "../src/checks/vet-search";

// T048 plan AC "Find vet nearby ... 'emergency vet near me' query for top
// tiers": EMERGENCY_NOW/VET_24H get the emergency query, everything else
// gets the routine query (D6).
describe("buildVetSearchQuery", () => {
  it.each([
    ["EMERGENCY_NOW", EMERGENCY_VET_QUERY],
    ["VET_24H", EMERGENCY_VET_QUERY],
    ["VET_SOON", ROUTINE_VET_QUERY],
    ["MONITOR", ROUTINE_VET_QUERY],
    ["REASSURE", ROUTINE_VET_QUERY],
  ] satisfies [Urgency, string][])("returns the correct query for %s", (tier, expected) => {
    expect(buildVetSearchQuery(tier)).toBe(expected);
  });

  it("covers every urgency tier", () => {
    for (const tier of URGENCY_TIERS) {
      expect(() => buildVetSearchQuery(tier)).not.toThrow();
    }
  });
});

describe("buildVetSearchUrl", () => {
  it("builds the emergency maps URL for EMERGENCY_NOW", () => {
    expect(buildVetSearchUrl("EMERGENCY_NOW")).toBe(
      `${VET_SEARCH_MAPS_BASE}${encodeURIComponent("emergency vet near me")}`,
    );
  });

  it("builds the routine maps URL for MONITOR", () => {
    expect(buildVetSearchUrl("MONITOR")).toBe(`${VET_SEARCH_MAPS_BASE}${encodeURIComponent("veterinarian near me")}`);
  });

  it("always starts with the maps base for every tier", () => {
    for (const tier of URGENCY_TIERS) {
      expect(buildVetSearchUrl(tier).startsWith(VET_SEARCH_MAPS_BASE)).toBe(true);
    }
  });
});
