import * as fixtures from "../src/services/preview-fixtures";

/**
 * PREVIEW-1 plan (AC scope-2 "fixtures audit"): scans EVERY string literal
 * reachable from `preview-fixtures.ts`'s exports -- recursively, whatever
 * shape each array/object/const takes -- so any fixture added or edited
 * later in that file is automatically covered, not just the fields
 * enumerated in the plan today. No real businesses/phones/addresses/
 * emails/URLs; no meds/dosing in store products; adopt fixtures are
 * §7-clean (rescue/adoption framing, never breeder/sale).
 */
function collectStrings(value: unknown, acc: string[] = []): string[] {
  if (typeof value === "string") {
    acc.push(value);
    return acc;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, acc));
    return acc;
  }
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, acc));
    return acc;
  }
  return acc;
}

const allStrings = collectStrings(fixtures);
const joined = allStrings.join(" | ");

describe("services preview fixtures: no phone numbers", () => {
  it("has no digit run of 7+ and no `+` followed by 2+ digits", () => {
    expect(joined).not.toMatch(/\d{7,}/);
    expect(joined).not.toMatch(/\+\d{2,}/);
  });
});

describe("services preview fixtures: no addresses/emails/URLs", () => {
  it("has no '@', no 'http', and no street-address tokens", () => {
    expect(joined).not.toMatch(/@/);
    expect(joined).not.toMatch(/http/i);
    expect(joined).not.toMatch(/\b(street|road|ave|avenue|marg|nagar|lane|block)\b/i);
  });
});

describe("services preview fixtures: store products carry no medication/dosing tokens", () => {
  it("PREVIEW_STORE_PRODUCTS has no mg/ml/dose/supplement/medication/etc.", () => {
    const productStrings = collectStrings(fixtures.PREVIEW_STORE_PRODUCTS).join(" | ");
    expect(productStrings).not.toMatch(
      /\b(mg|ml|dose|dosage|supplement|vitamin|medication|antibiotic|dewormer|tablet|capsule|painkill)\b/i,
    );
  });
});

describe("services preview fixtures: adopt fixtures are §7-clean (rescue framing, no breeder/sale)", () => {
  it("PREVIEW_ADOPT_PETS has no breeder/sale/price framing", () => {
    const adoptStrings = collectStrings(fixtures.PREVIEW_ADOPT_PETS).join(" | ");
    expect(adoptStrings).not.toMatch(/\b(breeder|breeding|for sale|stud|pedigree|price)\b/i);
  });

  it("every listedBy contains 'sample'", () => {
    for (const pet of fixtures.PREVIEW_ADOPT_PETS) {
      expect(pet.listedBy.toLowerCase()).toContain("sample");
    }
  });
});

describe("services preview fixtures: no currency and no success/forbidden vocabulary", () => {
  it("has no currency symbol", () => {
    expect(joined).not.toMatch(/[₹$€£]/);
  });

  it("has no success/forbidden lexeme (confirmed/booked/purchased/approved/success/order placed)", () => {
    expect(joined).not.toMatch(/\b(confirmed|booked|purchased|approved|success|order placed)\b/i);
  });
});
