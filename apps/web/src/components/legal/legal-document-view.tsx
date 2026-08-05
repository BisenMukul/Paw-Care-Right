import type { LegalDocument } from "../../legal/legal-document";
import { VetDisclaimer } from "../vet-disclaimer";
import { SiteFooter } from "../marketing/site-footer";
import { LegalReviewNotice } from "./legal-review-notice";

/**
 * Renders a whole `LegalDocument` (privacy or terms): title, effective-date
 * placeholder line, intro, then each section (`<section id=...>` so
 * in-page fragment links resolve) with its paragraphs, optional bullets and
 * optional `LEGAL-REVIEW` marker, followed by the shared `<VetDisclaimer/>`
 * and `<SiteFooter/>` (D5 — synchronous, presentational, no client code).
 */
export function LegalDocumentView({ document }: { document: LegalDocument }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold text-brand-900">{document.title}</h1>
      <p className="mt-2 text-sm text-brand-500">{document.effectiveDateLine}</p>

      {document.intro.map((paragraph, index) => (
        <p key={index} className="mt-4 text-brand-900">
          {paragraph}
        </p>
      ))}

      {document.sections.map((section) => (
        <section key={section.id} id={section.id} className="mt-8">
          <h2 className="text-lg font-semibold text-brand-900">{section.heading}</h2>
          {section.paragraphs.map((paragraph, index) => (
            <p key={index} className="mt-2 text-brand-900">
              {paragraph}
            </p>
          ))}
          {section.bullets ? (
            <ul className="mt-2 list-disc pl-5">
              {section.bullets.map((bullet) => (
                <li key={bullet} className="text-brand-900">
                  {bullet}
                </li>
              ))}
            </ul>
          ) : null}
          {section.legalReview ? <LegalReviewNotice topic={section.legalReview} /> : null}
        </section>
      ))}

      <div className="mt-8">
        <VetDisclaimer />
      </div>

      <SiteFooter />
    </main>
  );
}
