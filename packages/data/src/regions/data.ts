import type { RegionHotlineRow } from "./schema";

/**
 * PINNED (T049 plan "Rows"): factual, publicly-published animal-poison
 * hotlines, each with a `source` field AND a matching inline `// source:`
 * comment (R-hotline-verify — MUST be confirmed by the founder/vet at
 * review). Unknown/unverified regions intentionally resolve to the
 * no-number fallback rather than risk a wrong number (plan R7).
 */
export const REGION_HOTLINE_ROWS: readonly RegionHotlineRow[] = [
  // source: ASPCA APCC — aspca.org (public listing)
  {
    regionCode: "US",
    poisonHotlineName: "ASPCA Animal Poison Control Center",
    displayNumber: "(888) 426-4435",
    dialNumber: "+18884264435",
    feeNote: "A consultation fee may apply.",
    source: "ASPCA APCC — aspca.org (public listing)",
  },
  // source: Pet Poison Helpline — petpoisonhelpline.com (serves US & Canada)
  {
    regionCode: "CA",
    poisonHotlineName: "Pet Poison Helpline",
    displayNumber: "(855) 764-7661",
    dialNumber: "+18557647661",
    feeNote: "A consultation fee may apply.",
    source: "Pet Poison Helpline — petpoisonhelpline.com (serves US & Canada)",
  },
  // source: Animal PoisonLine — animalpoisonline.co.uk
  {
    regionCode: "GB",
    poisonHotlineName: "Animal PoisonLine",
    displayNumber: "01202 509000",
    dialNumber: "+441202509000",
    feeNote: "A consultation fee may apply.",
    source: "Animal PoisonLine — animalpoisonline.co.uk",
  },
  // source: Australian Animal Poisons Helpline — animalpoisons.com.au (free)
  {
    regionCode: "AU",
    poisonHotlineName: "Australian Animal Poisons Helpline",
    displayNumber: "1300 869 738",
    dialNumber: "1300869738",
    feeNote: null,
    source: "Australian Animal Poisons Helpline — animalpoisons.com.au (free)",
  },
  // source: Animal Poisons Helpline (NZ) — animalpoisons.com.au (NZ freephone, free)
  {
    regionCode: "NZ",
    poisonHotlineName: "Animal Poisons Helpline (NZ)",
    displayNumber: "0800 869 738",
    dialNumber: "0800869738",
    feeNote: null,
    source: "Animal Poisons Helpline (NZ) — animalpoisons.com.au (NZ freephone, free)",
  },
];
