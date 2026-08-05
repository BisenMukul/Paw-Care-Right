import { buildFaqJsonLd, jsonLdScriptContent } from "./json-ld";
import { buildFoodPageModel } from "./page-model";

describe("buildFaqJsonLd", () => {
  it("is a valid schema.org FAQPage with ≥2 Question entries, each with an acceptedAnswer.text", () => {
    const model = buildFoodPageModel("can-dogs-eat", "grapes")!;
    const jsonLd = buildFaqJsonLd(model);

    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@type"]).toBe("FAQPage");
    const mainEntity = jsonLd.mainEntity as Array<{
      "@type": string;
      name: string;
      acceptedAnswer: { "@type": string; text: string };
    }>;
    expect(Array.isArray(mainEntity)).toBe(true);
    expect(mainEntity.length).toBeGreaterThanOrEqual(2);
    for (const entry of mainEntity) {
      expect(entry["@type"]).toBe("Question");
      expect(typeof entry.name).toBe("string");
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.acceptedAnswer["@type"]).toBe("Answer");
      expect(entry.acceptedAnswer.text.length).toBeGreaterThan(0);
    }
  });

  it("the JSON-LD questions/answers are exactly the model's visible faq entries (D10)", () => {
    const model = buildFoodPageModel("can-cats-eat", "true-lilies")!;
    const jsonLd = buildFaqJsonLd(model);
    const mainEntity = jsonLd.mainEntity as Array<{
      name: string;
      acceptedAnswer: { text: string };
    }>;

    expect(mainEntity).toHaveLength(model.faq.length);
    mainEntity.forEach((entry, i) => {
      expect(entry.name).toBe(model.faq[i]!.question);
      expect(entry.acceptedAnswer.text).toBe(model.faq[i]!.answer);
    });
  });
});

describe("jsonLdScriptContent", () => {
  it("escapes < as \\u003c", () => {
    const output = jsonLdScriptContent({ text: "</script>" });
    expect(output).toContain("\\u003c/script>");
  });

  it("the output contains no literal </script>", () => {
    const output = jsonLdScriptContent({ text: "</script><script>alert(1)</script>" });
    expect(output).not.toContain("</script>");
  });

  it("still parses as valid JSON after unescaping back", () => {
    const value = { a: 1, b: "<tag>" };
    const output = jsonLdScriptContent(value);
    const parsed = JSON.parse(output.replace(/\\u003c/g, "<")) as typeof value;
    expect(parsed).toEqual(value);
  });
});
