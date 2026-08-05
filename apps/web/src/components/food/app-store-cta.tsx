import { APP_DISPLAY_NAME } from "@bombaypetcompany/config";

import { strings } from "../../strings";

/**
 * Honest "coming soon" app CTA (§5.7). No store links exist before C3/T099,
 * so this renders a non-linking badge — no `<a>` inside, no fabricated App
 * Store/Play URL.
 */
export function AppStoreCta() {
  return (
    <section data-testid="app-store-cta" className="rounded-lg bg-brand-50 p-4 text-center">
      <h2 className="text-lg font-semibold text-brand-900">{strings.foodPage.appCta.heading}</h2>
      <p className="mt-1 text-sm text-brand-900">{strings.foodPage.appCta.body(APP_DISPLAY_NAME)}</p>
      <span
        data-testid="app-store-badge"
        className="mt-3 inline-block rounded-full bg-brand-100 px-4 py-2 text-sm font-medium text-brand-700"
      >
        {strings.foodPage.appCta.badge}
      </span>
    </section>
  );
}
