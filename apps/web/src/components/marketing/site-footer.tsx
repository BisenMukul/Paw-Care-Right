import { APP_DISPLAY_NAME } from "@bombaypetcompany/config";

import { strings } from "../../strings";
import { MARKETING_ROUTES } from "../../routes";

/**
 * Shared footer for the three marketing pages (D4 — rendered by each page
 * body, never by `app/layout.tsx`, so T085's 474 built pages are unaffected).
 * Cross-links every marketing page to the other two (AC3).
 */
export function SiteFooter() {
  return (
    <footer data-testid="site-footer" className="mt-12 border-t border-brand-100 pt-6 text-sm text-brand-500">
      <nav className="flex gap-4">
        <a href={MARKETING_ROUTES.home} className="underline">
          {strings.footer.homeLabel}
        </a>
        <a href={MARKETING_ROUTES.privacy} className="underline">
          {strings.footer.privacyLabel}
        </a>
        <a href={MARKETING_ROUTES.terms} className="underline">
          {strings.footer.termsLabel}
        </a>
      </nav>
      <p className="mt-2">{strings.footer.notice(APP_DISPLAY_NAME)}</p>
    </footer>
  );
}
