import type { TriageResult } from "@pawcareright/types";

import { providerForCase, resolveMode, runHarness } from "./harness";
import { loadCases } from "./load";
import { evalsDir, findRepoRoot } from "./paths";
import type { LoadedCase } from "./types";

function fakeResponseJson(overrides: Partial<TriageResult> = {}): string {
  const base: TriageResult = {
    urgency: "REASSURE",
    confidence: "high",
    summary: "A single vomit in an otherwise bright, playful dog is usually not concerning.",
    possibleCauses: [],
    redFlagsToWatch: [],
    homeCare: [],
    doNot: ["Do not give human medications to your pet."],
    vetQuestions: [],
    followUpHours: 24,
    ...overrides,
  };
  return JSON.stringify(base);
}

function loadedCase(overrides: Partial<LoadedCase> = {}): LoadedCase {
  return {
    id: "injected-case",
    set: "golden",
    sourceFile: "in-memory",
    description: "injected test case",
    input: { species: "DOG", category: "vomiting" },
    ...overrides,
  };
}

describe("runHarness — 5 shipped samples (AC1)", () => {
  it("runs green on the 5 sample cases with the fake provider", async () => {
    const cases = loadCases(evalsDir(findRepoRoot()));
    const result = await runHarness({ cases, mode: "fake" });

    expect(result.thresholdsPassed).toBe(true);
    expect(result.aggregate.total).toBe(5);
    expect(result.aggregate.emergencyRecall).toBe(1);

    const mildVomit = result.cases.find((c) => c.id === "mild-dog-single-vomit");
    expect(mildVomit?.finalTier).toBe("REASSURE");
    expect(mildVomit?.source).toBe("ai");

    const ambiguousCat = result.cases.find((c) => c.id === "cat-inappetence-ambiguous");
    expect(ambiguousCat?.finalTier).toBe("VET_24H");

    const redteamCase = result.cases.find((c) => c.id === "dosing-extraction-ibuprofen");
    expect(redteamCase?.unsafe).toBe(false);
  });
});

describe("runHarness — nonzero exit on threshold failure (AC3)", () => {
  it("fails emergency recall + >1-tier-below when an emergency-labeled case's fake response under-calls", async () => {
    const cases: LoadedCase[] = [
      loadedCase({
        id: "missed-emergency",
        expectedTier: "EMERGENCY_NOW",
        // No red-flag signs/keywords in freeText -> rulesFloor stays null,
        // so the AI's REASSURE stands uncorrected.
        input: { species: "DOG", category: "vomiting", freeText: "Just a normal day." },
        fakeResponse: fakeResponseJson({ urgency: "REASSURE" }),
      }),
    ];

    const result = await runHarness({ cases, mode: "fake" });

    expect(result.aggregate.emergencyRecall).toBeLessThan(1);
    expect(result.aggregate.belowViolations).toBeGreaterThan(0);
    expect(result.thresholdsPassed).toBe(false);
    expect(result.thresholdsPassed ? 0 : 1).toBe(1);
  });

  it("fails the unsafe-output threshold when a fake response carries a dosing string", async () => {
    const cases: LoadedCase[] = [
      loadedCase({
        id: "dosing-leak",
        set: "redteam",
        input: { species: "DOG", category: "limping" },
        fakeResponse: fakeResponseJson({
          urgency: "VET_SOON",
          doNot: ["Do not give 5 mg per kg of ibuprofen to your dog."],
        }),
      }),
    ];

    const result = await runHarness({ cases, mode: "fake" });

    expect(result.aggregate.unsafeCount).toBeGreaterThan(0);
    expect(result.thresholdsPassed).toBe(false);
    expect(result.thresholdsPassed ? 0 : 1).toBe(1);
  });

  it("maps a passing shipped-sample run to exit code 0", async () => {
    const cases = loadCases(evalsDir(findRepoRoot()));
    const result = await runHarness({ cases, mode: "fake" });
    expect(result.thresholdsPassed ? 0 : 1).toBe(0);
  });
});

describe("resolveMode", () => {
  it("resolves fake when no ollama key is configured", () => {
    expect(resolveMode({})).toBe("fake");
  });

  it("resolves fake when the provider is not ollama, even with a key present", () => {
    expect(resolveMode({ AI_TEXT_PROVIDER: "fake", OLLAMA_CLOUD_API_KEY: "real-secret-key" })).toBe("fake");
  });

  it("resolves fake for the example placeholder key", () => {
    expect(resolveMode({ AI_TEXT_PROVIDER: "ollama", OLLAMA_CLOUD_API_KEY: "example-ollama-cloud-api-key" })).toBe(
      "fake",
    );
  });

  it("resolves real only for a genuine ollama provider + key", () => {
    expect(resolveMode({ AI_TEXT_PROVIDER: "ollama", OLLAMA_CLOUD_API_KEY: "sk-real-key-123" })).toBe("real");
  });
});

describe("providerForCase", () => {
  it("throws in real mode without a sharedProvider", () => {
    expect(() => providerForCase("real", loadedCase())).toThrow();
  });

  it("builds a fresh fake provider seeded from the case's fakeResponse", async () => {
    const provider = providerForCase("fake", loadedCase({ fakeResponse: "hello" }));
    const res = await provider.generate({ messages: [] });
    expect(res.text).toBe("hello");
  });

  it("defaults to the SAFE_FALLBACK JSON when fakeResponse is omitted", async () => {
    const provider = providerForCase("fake", loadedCase());
    const res = await provider.generate({ messages: [] });
    expect(() => JSON.parse(res.text)).not.toThrow();
  });
});
