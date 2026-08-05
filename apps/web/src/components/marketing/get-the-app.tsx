import type { LandingModel } from "../../marketing/landing-content";

/**
 * Honest "coming soon" store badges (non-linking `<span>`s, §5.7 — same
 * pattern as T085's `AppStoreCta`) plus the one real, functional affordance:
 * an app-scheme deep link built via `buildAppDeepLink()` (D2), with an
 * honest fallback note for the — currently universal — not-installed case.
 */
export function GetTheApp({ heading, body, badges, openInAppLabel, openInAppHref, notInstalledNote }: LandingModel["getTheApp"]) {
  return (
    <section id="get-the-app" className="mt-12">
      <h2 className="text-xl font-semibold text-brand-900">{heading}</h2>
      <p className="mt-2 text-brand-900">{body}</p>
      <div className="mt-4 flex gap-3">
        {badges.map((badge) => (
          <span
            key={badge}
            className="rounded-full bg-brand-100 px-4 py-2 text-sm font-medium text-brand-700"
          >
            {badge}
          </span>
        ))}
      </div>
      <p className="mt-4">
        <a href={openInAppHref} className="text-brand-700 underline">
          {openInAppLabel}
        </a>
      </p>
      <p className="mt-1 text-sm text-brand-500">{notInstalledNote}</p>
    </section>
  );
}
