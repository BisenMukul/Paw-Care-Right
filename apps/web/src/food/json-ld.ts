// schema.org FAQPage JSON-LD for the programmatic food-safety pages (T085).
// Built from the SAME `model.faq` array the visible FAQ section renders
// (D10) — Google requires FAQ markup to match visible content exactly.
import type { FoodPageModel } from "./page-model";

export function buildFaqJsonLd(model: FoodPageModel): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: model.faq.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: entry.answer,
      },
    })),
  };
}

/** `JSON.stringify` + escape every `<` so `</script>` can never break out. */
export function jsonLdScriptContent(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
