import { strings } from "../../strings";
import { buildFaqJsonLd, jsonLdScriptContent } from "../../food/json-ld";
import type { FoodPageModel } from "../../food/page-model";
import { VetDisclaimer } from "../vet-disclaimer";
import { AppStoreCta } from "./app-store-cta";
import { EmergencyHotlineCta } from "./emergency-hotline-cta";

/**
 * Whole visible page body for one `/can-{species}-eat/{item}` page (D4).
 * Synchronous presentational component — takes a plain `FoodPageModel`, no
 * data fetching, no client-only behaviour, so it can be rendered with
 * `react-dom/server`'s `renderToStaticMarkup` in tests with zero new deps.
 *
 * Rendering order (pinned by the plan, plus the R4 orchestrator decision):
 *   JSON-LD <script> → urgent hotline CTA (conditional, first visible block,
 *   before <h1>) → verdict hero → nuance → quantity (conditional) → FAQ →
 *   cross-links → app-store CTA → informational hotline section (always-on,
 *   R4) → <VetDisclaimer/>.
 */
export function FoodPageView({ model }: { model: FoodPageModel }) {
  const jsonLd = buildFaqJsonLd(model);

  return (
    <>
      {/* JSON-LD escaped by jsonLdScriptContent ("<" -> "<") — safe against script-breakout. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScriptContent(jsonLd) }}
      />
      <main className="mx-auto max-w-2xl px-4 py-8">
        {model.showHotlineCta ? <EmergencyHotlineCta variant="urgent" /> : null}

        <h1 className="mt-6 text-3xl font-bold text-brand-900">{model.title}</h1>
        <span className="mt-2 inline-block rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-700">
          {model.verdictLabel}
        </span>
        <p className="mt-2 text-lg text-brand-900">{model.verdictHeadline}</p>

        <section className="mt-6">
          <h2 className="text-lg font-semibold text-brand-900">{strings.foodPage.noteHeading}</h2>
          <p className="mt-1 text-brand-900">{model.note}</p>
        </section>

        {model.quantityNuance ? (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-brand-900">{strings.foodPage.quantityHeading}</h2>
            <p className="mt-1 text-brand-900">{model.quantityNuance}</p>
          </section>
        ) : null}

        <section className="mt-6">
          <h2 className="text-lg font-semibold text-brand-900">{strings.foodPage.faqHeading}</h2>
          <dl className="mt-2 space-y-4">
            {model.faq.map((entry) => (
              <div key={entry.question}>
                <dt className="font-medium text-brand-900">{entry.question}</dt>
                <dd className="mt-1 text-brand-900">{entry.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-semibold text-brand-900">{strings.foodPage.crossLinks.otherSpecies}</h2>
          <ul className="mt-2">
            <li>
              <a href={model.otherSpecies.href} className="text-brand-700 underline">
                {model.otherSpecies.label}
              </a>
            </li>
          </ul>
        </section>

        {model.relatedItems.length > 0 ? (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-brand-900">{strings.foodPage.crossLinks.related}</h2>
            <ul className="mt-2 space-y-1">
              {model.relatedItems.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="text-brand-700 underline">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-6">
          <AppStoreCta />
        </div>

        {/* R4 — always-on informational hotline section, every verdict. */}
        <div className="mt-6">
          <EmergencyHotlineCta variant="info" />
        </div>

        <div className="mt-6">
          <VetDisclaimer />
        </div>
      </main>
    </>
  );
}
