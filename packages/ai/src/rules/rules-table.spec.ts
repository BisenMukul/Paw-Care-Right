import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SPECIES, URGENCY_TIERS } from "@pawcareright/types";

import { RED_FLAG_RULES } from "./rules-table";

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe("rules table integrity", () => {
  it("has at least 18 rules", () => {
    expect(RED_FLAG_RULES.length).toBeGreaterThanOrEqual(18);
  });

  it("has exactly the planned 22 rules", () => {
    expect(RED_FLAG_RULES.length).toBe(22);
  });

  it("every id is unique", () => {
    const ids = RED_FLAG_RULES.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every id matches kebab-case", () => {
    RED_FLAG_RULES.forEach((rule) => {
      expect(rule.id).toMatch(KEBAB_CASE);
    });
  });

  it("every emergencyPayloadKey matches kebab-case", () => {
    RED_FLAG_RULES.forEach((rule) => {
      expect(rule.emergencyPayloadKey).toMatch(KEBAB_CASE);
    });
  });

  it("every tierFloor is a valid Urgency tier", () => {
    RED_FLAG_RULES.forEach((rule) => {
      expect(URGENCY_TIERS).toContain(rule.tierFloor);
    });
  });

  it("every species is DOG, CAT, or ANY", () => {
    RED_FLAG_RULES.forEach((rule) => {
      expect([...SPECIES, "ANY"]).toContain(rule.species);
    });
  });

  it("every rule has a non-empty label and sourceRef", () => {
    RED_FLAG_RULES.forEach((rule) => {
      expect(rule.label.length).toBeGreaterThan(0);
      expect(rule.sourceRef.length).toBeGreaterThan(0);
    });
  });
});

describe("all SPEC §6.2 examples are represented", () => {
  const expectedPayloadKeys = [
    "toxin-ingestion",
    "gdv-suspected",
    "urinary-blockage-cat",
    "seizure-prolonged-or-repeated",
    "collapse-unresponsive",
    "abnormal-gum-color",
    "breathing-difficulty",
    "uncontrolled-bleeding",
    "heatstroke",
    "envenomation",
    "major-trauma",
    "ocular-emergency",
    "sudden-inability-to-stand",
  ];

  it("has a rule for every §6.2 payload key", () => {
    const actualPayloadKeys = RED_FLAG_RULES.map((rule) => rule.emergencyPayloadKey);
    expectedPayloadKeys.forEach((key) => {
      expect(actualPayloadKeys).toContain(key);
    });
  });
});

describe("table contains no dosing/treatment/drug content", () => {
  // CLAUDE §7 rule 2 / SPEC §5 rule 4 mechanical guard.
  const FORBIDDEN_PATTERN =
    /\bmg\b|\bml\b|\bdose|dosage|milligram|per kg|administer|tablet|\bgive (?:him|her|it|your)|\bml\/kg\b|ibuprofen|paracetamol|acetaminophen|aspirin|benadryl|diphenhydramine|metacam|tramadol/i;

  function collectKeywordPhrases(match: unknown): string[] {
    if (match === null || typeof match !== "object") return [];
    if ("kw" in match) {
      return [...(match as { kw: readonly string[] }).kw];
    }
    if ("allOf" in match) {
      return (match as { allOf: readonly unknown[] }).allOf.flatMap(collectKeywordPhrases);
    }
    if ("anyOf" in match) {
      return (match as { anyOf: readonly unknown[] }).anyOf.flatMap(collectKeywordPhrases);
    }
    return [];
  }

  it("scans every id/label/payloadKey/sourceRef/keyword phrase for forbidden dosing/drug terms", () => {
    const haystack = RED_FLAG_RULES.flatMap((rule) => [
      rule.id,
      rule.label,
      rule.emergencyPayloadKey,
      rule.sourceRef,
      ...collectKeywordPhrases(rule.match),
    ]).join(" | ");

    expect(FORBIDDEN_PATTERN.test(haystack)).toBe(false);
  });
});

describe("rules module imports no provider", () => {
  it("none of the rules/*.ts source files import providers/registry/http", () => {
    const files = ["types.ts", "normalize.ts", "rules-table.ts", "engine.ts", "index.ts"];
    const forbiddenImport = /from\s+["'][^"']*(providers|registry|\bhttp\b)[^"']*["']/i;

    files.forEach((file) => {
      const contents = readFileSync(join(__dirname, file), "utf8");
      expect(forbiddenImport.test(contents)).toBe(false);
    });
  });
});
