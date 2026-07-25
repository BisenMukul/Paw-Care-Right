import type { LandingModel } from "../../marketing/landing-content";
import { strings } from "../../strings";
import { VetDisclaimer } from "../vet-disclaimer";
import { GetTheApp } from "./get-the-app";
import { SiteFooter } from "./site-footer";

/**
 * Whole landing-page body (D5 — synchronous, presentational, takes a plain
 * `LandingModel`). Section order is pinned by the plan:
 *   hero (contains the emergency note) -> how-it-works -> pricing -> faq
 *   -> get-the-app -> popular-answers -> <VetDisclaimer/> -> <SiteFooter/>.
 * The emergency note renders inside the hero, i.e. before pricing/faq, so
 * fail-upward messaging is never buried below a purchase-adjacent section.
 */
export function LandingView({ model }: { model: LandingModel }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <section id="hero">
        <h1 className="text-4xl font-bold text-brand-700">{model.hero.title}</h1>
        <p className="mt-2 text-lg text-brand-500">{model.hero.tagline}</p>
        <p className="mt-4 max-w-xl text-base text-brand-900">{model.hero.body}</p>
        <p
          data-testid="landing-emergency-note"
          role="note"
          className="mt-4 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-900"
        >
          {model.emergencyNote}
        </p>
      </section>

      <section id="how-it-works" className="mt-12">
        <h2 className="text-xl font-semibold text-brand-900">{strings.landing.howItWorksHeading}</h2>
        <ol className="mt-4 space-y-4">
          {model.steps.map((step) => (
            <li key={step.id}>
              <h3 className="font-medium text-brand-900">{step.heading}</h3>
              <p className="mt-1 text-brand-900">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="pricing" className="mt-12">
        <h2 className="text-xl font-semibold text-brand-900">{model.pricing.heading}</h2>
        <p className="mt-2 text-sm text-brand-500">{model.pricing.notice}</p>
        <p className="mt-1 text-sm text-brand-500">{strings.landing.pricing.trialNote}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {model.pricing.plans.map((plan) => (
            <div
              key={plan.id}
              className={
                plan.highlighted
                  ? "rounded-lg border-2 border-brand-700 p-4"
                  : "rounded-lg border border-brand-100 p-4"
              }
            >
              <h3 className="font-semibold text-brand-900">{plan.name}</h3>
              <p className="mt-1 text-2xl font-bold text-brand-900">{plan.price}</p>
              <p className="text-sm text-brand-500">{plan.cadence}</p>
              <p className="mt-2 text-sm text-brand-900">{plan.note}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-brand-900">{model.pricing.freeTierNote}</p>
      </section>

      <section id="faq" className="mt-12">
        <h2 className="text-xl font-semibold text-brand-900">{strings.landing.faqHeading}</h2>
        <dl className="mt-4 space-y-4">
          {model.faq.map((entry) => (
            <div key={entry.question}>
              <dt className="font-medium text-brand-900">{entry.question}</dt>
              <dd className="mt-1 text-brand-900">{entry.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <GetTheApp {...model.getTheApp} />

      <section id="popular-answers" className="mt-12">
        <h2 className="text-xl font-semibold text-brand-900">{model.popularAnswers.heading}</h2>
        <ul className="mt-4 space-y-1">
          {model.popularAnswers.links.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="text-brand-700 underline">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-12">
        <VetDisclaimer />
      </div>

      <SiteFooter />
    </main>
  );
}
