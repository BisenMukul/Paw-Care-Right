import { buildFoodSafetyPrompt, FOOD_SAFETY_PROMPT_VERSION } from "./prompt";

describe("buildFoodSafetyPrompt", () => {
  it("matches the static system prompt (snapshot)", () => {
    expect(buildFoodSafetyPrompt("DOG", "chocolate").system).toMatchSnapshot();
  });

  it("is deterministic across calls for the same input", () => {
    expect(buildFoodSafetyPrompt("DOG", "chocolate")).toEqual(buildFoodSafetyPrompt("DOG", "chocolate"));
  });

  it("uses temperature 0", () => {
    expect(buildFoodSafetyPrompt("DOG", "chocolate").temperature).toBe(0);
  });

  it("tags the built prompt with FOOD_SAFETY_PROMPT_VERSION", () => {
    expect(buildFoodSafetyPrompt("DOG", "chocolate").version).toBe(FOOD_SAFETY_PROMPT_VERSION);
    expect(buildFoodSafetyPrompt("DOG", "chocolate").system).toContain(`Prompt version: ${FOOD_SAFETY_PROMPT_VERSION}`);
  });

  it("embeds the verdict schema (safe | caution | toxic | emergency)", () => {
    expect(buildFoodSafetyPrompt("DOG", "chocolate").system).toContain(
      '"verdict": <one of: safe | caution | toxic | emergency>',
    );
  });

  it("contains the return-only-JSON output-contract instruction", () => {
    expect(buildFoodSafetyPrompt("DOG", "chocolate").system).toContain(
      "Return ONLY a single JSON object matching the schema below. No markdown, no code fences, no text before or after the JSON.",
    );
  });

  it("instructs a caution bias on uncertainty and restricts 'safe' to confident cases", () => {
    const system = buildFoodSafetyPrompt("DOG", "chocolate").system;
    expect(system).toMatch(/choose the more cautious verdict/i);
    expect(system).toMatch(/never guess toward `safe`/i);
    expect(system).toMatch(/only use "safe" when you are confident/i);
  });

  it("instructs never to use the words diagnosis/diagnose", () => {
    expect(buildFoodSafetyPrompt("DOG", "chocolate").system).toMatch(/never use the words "diagnosis" or "diagnose"/i);
  });

  it("instructs never to give a dosing amount/unit or per-bodyweight figure", () => {
    expect(buildFoodSafetyPrompt("DOG", "chocolate").system).toMatch(
      /never give a dosing amount, a numeric quantity with a unit, or an amount-per-bodyweight figure/i,
    );
  });

  it("instructs never to recommend or name a drug to give", () => {
    expect(buildFoodSafetyPrompt("DOG", "chocolate").system).toMatch(/never recommend or name a drug to give/i);
  });

  it('contains the literal word "diagnos" only inside the one never-use-it safety rule', () => {
    const system = buildFoodSafetyPrompt("DOG", "chocolate").system;
    const matches = system.match(/diagnos/gi) ?? [];
    // "diagnosis" + "diagnose" inside the single safety-rule bullet — 2 hits, nowhere else.
    expect(matches.length).toBe(2);
  });

  it("contains no dosing-shaped numeric/unit language anywhere in the system prompt", () => {
    const system = buildFoodSafetyPrompt("DOG", "chocolate").system;
    expect(/\b\d+\s*(mg|ml|mcg|g|kg|iu)\b/i.test(system)).toBe(false);
    expect(/mg\s*\/\s*kg/i.test(system)).toBe(false);
    expect(/per\s+(kg|pound|lb)\b/i.test(system)).toBe(false);
  });

  it("puts the species and item into the single user message", () => {
    const built = buildFoodSafetyPrompt("CAT", "lilies");
    expect(built.messages).toHaveLength(1);
    expect(built.messages[0]).toEqual({
      role: "user",
      content: 'Species: CAT. Is "lilies" safe for this pet to eat or be exposed to?',
    });
  });
});
